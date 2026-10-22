import Foundation
import Capacitor
import HealthKit

/// Puente de SOLO LECTURA entre la app web y Salud (HealthKit).
///
/// - Pide permiso únicamente de lectura (no se escribe nada en Salud).
/// - Usa HKAnchoredObjectQuery para importar de forma repetible: devuelve muestras nuevas
///   y los UUID de muestras borradas desde el ancla anterior.
/// - Informa la fuente original (nombre, bundle id, modelo) y si la muestra fue ingresada
///   a mano (HKMetadataKeyWasUserEntered) para poder excluirla de metas "del reloj".
/// - Por diseño de Apple, la app no puede saber si se negó el permiso de lectura:
///   en ese caso las consultas simplemente devuelven cero muestras.
@objc(HealthBridgePlugin)
public class HealthBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthBridgePlugin"
    public let jsName = "HealthBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReadAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchChanges", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchHeartRateDaily", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()
    private let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())

    private func sampleType(_ name: String) -> HKSampleType? {
        switch name {
        case "steps": return HKQuantityType.quantityType(forIdentifier: .stepCount)
        case "sleep": return HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
        case "restingHr": return HKQuantityType.quantityType(forIdentifier: .restingHeartRate)
        case "workout": return HKObjectType.workoutType()
        default: return nil
        }
    }

    private var readTypes: Set<HKObjectType> {
        var s = Set<HKObjectType>()
        for n in ["steps", "sleep", "restingHr", "workout"] { if let t = sampleType(n) { s.insert(t) } }
        if let hr = HKQuantityType.quantityType(forIdentifier: .heartRate) { s.insert(hr) }
        return s
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestReadAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Salud no está disponible en este dispositivo.")
            return
        }
        // toShare vacío: la app no pide permiso de escritura.
        store.requestAuthorization(toShare: Set<HKSampleType>(), read: readTypes) { ok, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            // "ok" solo indica que el pedido se mostró/procesó, no que se haya concedido lectura.
            call.resolve(["requested": ok])
        }
    }

    @objc func fetchChanges(_ call: CAPPluginCall) {
        guard let typeName = call.getString("type"), let type = sampleType(typeName) else {
            call.reject("Tipo desconocido")
            return
        }
        let startMs = call.getDouble("startMs") ?? 0
        var anchor: HKQueryAnchor? = nil
        if let a = call.getString("anchor"), let data = Data(base64Encoded: a) {
            anchor = try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
        }
        let predicate = HKQuery.predicateForSamples(withStart: Date(timeIntervalSince1970: startMs / 1000), end: nil, options: [])

        let query = HKAnchoredObjectQuery(type: type, predicate: predicate, anchor: anchor, limit: HKObjectQueryNoLimit) { [weak self] _, samples, deleted, newAnchor, error in
            guard let self = self else { return }
            if let error = error {
                call.reject(self.describe(error))
                return
            }
            let out: [[String: Any]] = (samples ?? []).compactMap { self.serialize($0, typeName: typeName) }
            var result: [String: Any] = [
                "samples": out,
                "deleted": (deleted ?? []).map { $0.uuid.uuidString },
            ]
            if let na = newAnchor, let data = try? NSKeyedArchiver.archivedData(withRootObject: na, requiringSecureCoding: true) {
                result["anchor"] = data.base64EncodedString()
            }
            call.resolve(result)
        }
        store.execute(query)
    }

    /// Frecuencia cardíaca diaria (mín/prom/máx) por fuente, con días calculados en la zona horaria pedida.
    @objc func fetchHeartRateDaily(_ call: CAPPluginCall) {
        guard let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            call.reject("Frecuencia cardíaca no disponible")
            return
        }
        let start = Date(timeIntervalSince1970: (call.getDouble("startMs") ?? 0) / 1000)
        let end = Date(timeIntervalSince1970: (call.getDouble("endMs") ?? Date().timeIntervalSince1970 * 1000) / 1000)
        let tz = TimeZone(identifier: call.getString("timeZone") ?? "America/Argentina/Buenos_Aires") ?? TimeZone.current
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let anchorDate = cal.startOfDay(for: start)
        let fmt = DateFormatter()
        fmt.calendar = cal
        fmt.timeZone = tz
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let query = HKStatisticsCollectionQuery(
            quantityType: hrType,
            quantitySamplePredicate: predicate,
            options: [.discreteAverage, .discreteMin, .discreteMax, .separateBySource],
            anchorDate: anchorDate,
            intervalComponents: DateComponents(day: 1)
        )
        query.initialResultsHandler = { [weak self] _, results, error in
            guard let self = self else { return }
            if let error = error {
                call.reject(self.describe(error))
                return
            }
            var rows: [[String: Any]] = []
            results?.enumerateStatistics(from: start, to: end) { stats, _ in
                for source in stats.sources ?? [] {
                    guard let avg = stats.averageQuantity(for: source)?.doubleValue(for: self.bpm) else { continue }
                    rows.append([
                        "date": fmt.string(from: stats.startDate),
                        "sourceId": source.bundleIdentifier,
                        "sourceName": source.name,
                        "avg": avg,
                        "min": stats.minimumQuantity(for: source)?.doubleValue(for: self.bpm) ?? avg,
                        "max": stats.maximumQuantity(for: source)?.doubleValue(for: self.bpm) ?? avg,
                    ])
                }
            }
            call.resolve(["rows": rows])
        }
        store.execute(query)
    }

    // MARK: - Serialización

    private func serialize(_ s: HKSample, typeName: String) -> [String: Any]? {
        let rev = s.sourceRevision
        var d: [String: Any] = [
            "uuid": s.uuid.uuidString,
            "start": s.startDate.timeIntervalSince1970 * 1000,
            "end": s.endDate.timeIntervalSince1970 * 1000,
            "sourceName": rev.source.name,
            "sourceId": rev.source.bundleIdentifier,
            "userEntered": (s.metadata?[HKMetadataKeyWasUserEntered] as? Bool) ?? false,
        ]
        if let pt = rev.productType { d["productType"] = pt }
        if let dev = s.device?.name { d["deviceName"] = dev }

        switch typeName {
        case "steps":
            guard let q = s as? HKQuantitySample else { return nil }
            d["value"] = q.quantity.doubleValue(for: .count())
        case "restingHr":
            guard let q = s as? HKQuantitySample else { return nil }
            d["value"] = q.quantity.doubleValue(for: bpm)
        case "sleep":
            guard let c = s as? HKCategorySample else { return nil }
            d["value"] = c.value
        case "workout":
            guard let w = s as? HKWorkout else { return nil }
            d["value"] = w.duration
            d["label"] = workoutName(w.workoutActivityType)
            if #available(iOS 16.0, *) {
                if let e = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
                   let kcal = w.statistics(for: e)?.sumQuantity()?.doubleValue(for: .kilocalorie()) {
                    d["value2"] = kcal
                }
                if let hr = HKQuantityType.quantityType(forIdentifier: .heartRate),
                   let avg = w.statistics(for: hr)?.averageQuantity()?.doubleValue(for: bpm) {
                    d["value3"] = avg
                }
            } else if let kcal = w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) {
                d["value2"] = kcal
            }
        default:
            return nil
        }
        return d
    }

    private func workoutName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .traditionalStrengthTraining: return "Fuerza tradicional"
        case .functionalStrengthTraining: return "Fuerza funcional"
        case .walking: return "Caminata"
        case .running: return "Carrera"
        case .cycling: return "Ciclismo"
        case .elliptical: return "Elíptico"
        case .stairClimbing: return "Escaleras"
        case .highIntensityIntervalTraining: return "HIIT"
        case .mixedCardio: return "Cardio"
        case .coreTraining: return "Core"
        case .flexibility: return "Flexibilidad"
        case .yoga: return "Yoga"
        case .swimming: return "Natación"
        case .rowing: return "Remo"
        case .hiking: return "Senderismo"
        case .boxing: return "Boxeo"
        default: return "Entrenamiento (\(t.rawValue))"
        }
    }

    private func describe(_ error: Error) -> String {
        if let hk = error as? HKError {
            switch hk.code {
            case .errorAuthorizationNotDetermined: return "Todavía no se pidió permiso para leer Salud. Tocá \"Conectar con Salud\"."
            case .errorDatabaseInaccessible: return "Salud no está accesible con el iPhone bloqueado. Desbloquealo y probá de nuevo."
            case .errorHealthDataUnavailable: return "Salud no está disponible en este dispositivo."
            default: break
            }
        }
        return error.localizedDescription
    }
}
