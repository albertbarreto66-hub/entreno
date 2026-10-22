import UIKit
import Capacitor

/// Registra el plugin local de Salud en el puente de Capacitor.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthBridgePlugin())
    }
}
