# Entreno — app personal de entrenamiento

App privada en español (Argentina) para checks diarios, gimnasio de lunes a viernes, comidas, pasos, líquidos, peso, cintura, fotos y tendencias. Todo se guarda **solo en el dispositivo** (IndexedDB, fotos incluidas). No hay cuentas, servidor, analíticas ni claves.

- **Web/PWA** (React + TypeScript + Vite): instalable y usable sin conexión después de la primera carga.
- **iOS** (Capacitor 7 + plugin Swift propio): la misma interfaz más lectura de Salud (Apple Health) para traer los datos de Garmin.

## Ejecutar la versión web

Requisitos: Node 20 o superior.

```bash
npm install
npm start            # compila y sirve en http://localhost:4173
# o, para desarrollo con recarga:
npm run dev          # http://localhost:5173
```

Para usarla en el iPhone como PWA, el iPhone tiene que poder abrir la dirección. Por ejemplo, `npm start` en tu computadora y abrir `http://<IP-de-tu-compu>:4173` desde el iPhone (misma red Wi-Fi). Después: Safari → Compartir → **Agregar a inicio**.
Nota: los service workers (modo sin conexión) solo funcionan en `localhost` o con **HTTPS**. Por una IP local sin HTTPS la app funciona, pero sin modo offline. Si la querés publicar, hacelo de forma privada: la app no se despliega públicamente por defecto.

## Pruebas

```bash
npm test             # 65 pruebas unitarias: fechas, metas, pasos, progresión, nutrición, tendencias, persistencia, respaldo, importación de Salud
npm run test:e2e     # 8 pruebas de punta a punta en Chromium con pantalla de iPhone
```

Si Playwright no encuentra Chromium, definí `CHROME_PATH` con la ruta a un Chrome/Chromium instalado.

## Programa de 24 semanas

**Progreso → Programa → "Aplicar programa"**: fija la semana 1 (el lunes), las metas (calorías y proteína del menú, pasos según tu promedio) y el horario propuesto. Las metas rigen desde ese día, el historial no se toca y no se borran registros.

- **Entrenamiento**: híbrido torso / pierna de 5 días, de hasta 60 minutos. Lunes Torso A (pecho superior y hombros), martes Pierna A, miércoles Torso B (espalda y bíceps), jueves Pierna B y core, viernes Torso C (hombros, pecho superior y brazos).
- **6 bloques de 4 semanas** (`src/data/program.ts`): adaptación, acumulación, hipertrofia+, fuerza-hipertrofia, volumen máximo y consolidación. Las semanas 12 y 24 son de descarga.
- **Kilos y repeticiones indicados** (`prescribe` en `src/lib/training.ts`, doble progresión):
  - La primera vez es de calibración.
  - Si completás el tope del rango en todas las series, sin dolor y con margen, la próxima sesión sube el incremento mínimo.
  - Si no, mantiene el peso y pide 1 repetición más.
  - Con dolor o mala recuperación no sube; con dolor fuerte baja un 10 %.
- **Modo guiado**: "Hecha" completa la serie con lo indicado, los ejercicios terminados se cierran y la sesión termina solo con "Finalizar entrenamiento". Cada ejercicio tiene un link a una **búsqueda** de YouTube con su técnica; no es un video elegido a mano.
- **Control semanal** (`src/lib/checkin.ts`): promedio semanal de peso, abdomen, pecho y bíceps, más energía, hambre y recuperación. Sugiere −150 o +150 kcal, más pasos o menos volumen según criterios explícitos, y cada cambio requiere aceptación.
- **Calorías** (`src/lib/energy.ts`): metabolismo basal con Mifflin-St Jeor por un factor de actividad, con un déficit de ~25 %. Es una estimación de ±10–15 % que se ajusta con el control semanal.

## Respaldo y restauración

**Ajustes → Respaldo → Exportar respaldo completo (.zip).**

El ZIP contiene:

- `data.json`: todos los registros (perfil, ajustes, metas con historial, días, comidas, líquidos, sesiones, peso/cintura, progresiones aceptadas, datos importados de Salud).
- `photos/`: cada foto como archivo `.jpg`.

**Restaurar:** Ajustes → Respaldo → elegir el ZIP. La app lo **valida** (formato, versión, identificadores, fechas, que cada foto tenga su archivo) y muestra una **vista previa** con la cantidad de registros del respaldo y los actuales. Nada se reemplaza hasta que confirmes; el reemplazo se hace en una sola transacción (todo o nada). Hay un botón para exportar los datos actuales antes de reemplazarlos.

En la app iOS el ZIP se guarda en Archivos → En mi iPhone → Entreno y se abre la hoja de compartir.

> Los datos locales pueden perderse si borrás los datos del navegador o del sitio, desinstalás la app o el sistema libera espacio. Exportá respaldos con frecuencia. No hay sincronización entre dispositivos.

## Versión iOS con Garmin (Garmin → Garmin Connect → Salud → Entreno)

Una PWA no puede leer HealthKit: Apple solo lo permite a apps nativas. Por eso está el proyecto `ios/` (Capacitor) con un plugin Swift propio, `ios/App/App/HealthBridgePlugin.swift`, sin dependencias de terceros para Salud.

### Qué hace el plugin

- Pide permiso **solo de lectura**: pasos, sueño, frecuencia cardíaca, FC en reposo y entrenamientos. No escribe nada en Salud.
- Usa `HKAnchoredObjectQuery` con un ancla por tipo: cada actualización trae solo lo nuevo y los **UUID borrados** (Garmin o vos pueden corregir datos). La importación se puede repetir sin duplicados.
- Guarda por registro: UUID, tipo, inicio/fin, día local asignado, valor, **fuente original** (nombre y bundle id), modelo de dispositivo, si fue **ingresado a mano** en Salud (`HKMetadataKeyWasUserEntered`), fecha de importación y de actualización.
- FC diaria (mín/prom/máx por fuente) con `HKStatisticsCollectionQuery`, con días de `America/Argentina/Buenos_Aires`.
- Primera importación: últimos 30 días.

### Reglas de datos

- **Pasos:** nunca se suman Garmin + iPhone. Se usa la fuente preferida (Reloj/Garmin por defecto, configurable). Las muestras que cruzan la medianoche se prorratean.
- **Meta de pasos:** en Ajustes → Salud elegís si la completan "Solo datos del reloj" (excluye manuales de la app y los marcados como manuales en Salud) o "Reloj o manual". Se completa sola con los datos importados.
- **Sin datos ≠ cero:** si no hay muestras, se muestra "Sin datos disponibles". Apple no le informa a la app si negaste el permiso de lectura, así que la app no afirma saberlo.
- **Entrenamientos del reloj:** se muestran como actividad (duración, energía y FC si existen). **No** marcan ejercicios, series, cargas ni repeticiones como hechos.
- Comidas, agua, cargas y repeticiones nunca se toman de Salud.
- El sueño se asigna al día en que te despertás; se usa una sola fuente y se unen intervalos superpuestos.
- Si Garmin aparece con otro nombre, en Ajustes → Salud → Fuentes detectadas podés marcar "Es mi reloj".

### Compilar e instalar en tu iPhone (pasos inevitables)

Necesitás una Mac con Xcode 16 o posterior y tu iPhone. No se pueden evitar la firma ni el permiso de Salud.

1. `npm install` y `npm run build:ios` (compila la web sin service worker y la copia a `ios/`).
2. Abrí `ios/App/App.xcodeproj` en Xcode. La primera vez descarga los paquetes Swift (Capacitor); esperá a que termine.
3. Target **App** → Signing & Capabilities: elegí tu **Team** (sirve tu Apple ID; según la página oficial de Apple, HealthKit está disponible también para cuentas gratuitas). Si el Bundle Identifier `ar.albert.entreno` está ocupado, cambialo (por ejemplo, `com.tunombre.entreno`). La capacidad HealthKit ya está declarada en `App/App.entitlements`.
4. Conectá el iPhone, activá el **Modo desarrollador** (Ajustes → Privacidad y seguridad), elegilo como destino y tocá Run.
5. En el iPhone, si lo pide: Ajustes → General → VPN y gestión de dispositivos → confiar en tu certificado de desarrollador.
6. En Garmin Connect: activá compartir con Salud (en la sección de apps conectadas) y elegí qué datos enviar. Abrí Garmin Connect para que sincronice.
7. En Entreno: Ajustes → Salud y Garmin → **Conectar con Salud (solo lectura)** → aceptá los permisos en la hoja de iOS. Después usá **Actualizar ahora** cuando quieras.

Con una cuenta gratuita, la app firmada vence a los pocos días (Apple limita esos perfiles) y hay que volver a ejecutarla desde Xcode; con el Apple Developer Program dura más. Los datos quedan en el iPhone mientras no desinstales la app.

Los avisos del horario en la app iOS son notificaciones locales (funcionan con la app cerrada). En la PWA, solo mientras la app está abierta.

### Estado de la verificación iOS

| Verificado acá (Linux, sin Xcode) | Pendiente de probar en Mac + iPhone |
|---|---|
| Proyecto Capacitor generado (SPM) y sincronizado con 3 plugins oficiales | Que compile en Xcode (no hay compilador Swift acá) |
| `project.pbxproj` parseable; los 2 archivos Swift en la fase de compilación; entitlements en Debug y Release | Firma, instalación y hoja de permisos de Salud |
| Sintaxis Swift sin errores (parser tree-sitter) | Datos reales de Garmin en Salud: nombre/bundle id de la fuente, formato de las muestras de sueño |
| Lógica TypeScript de importación con un doble de prueba: sin duplicados, borrados, política de pasos, manuales excluidos, "sin datos" ≠ 0 | Rendimiento con meses de datos, notificaciones locales, exportar ZIP por la hoja de compartir |

## Publicación en GitHub Pages (uso diario en el iPhone)

Cada push a `main` corre las pruebas y publica la web en GitHub Pages (`.github/workflows/pages.yml`).
La dirección queda así: `https://<usuario>.github.io/<repo>/`. Abrila en Safari, tocá Compartir → **Agregar a inicio**, y desde ahí funciona sin conexión.

Si es la primera vez, en el repo: **Settings → Pages → Source: GitHub Actions**.

### Tus datos personales no están en el código

El repositorio es público y el código no tiene datos personales. Tu perfil se carga de una de estas dos formas:

- **En el iPhone:** Ajustes → Respaldo → Restaurar, eligiendo `perfil-albert.zip`, que se guarda fuera del repo.
- **Para un build local con el perfil precargado:** creá `private/perfil.json` (ignorado por git) y compilá con `PERFIL_PRIVADO=1 npm run build`. `npx vite-node --config vitest.config.ts scripts/perfil.ts perfil.zip` genera el ZIP de perfil a partir de ese archivo.

## App iOS compilada en GitHub

`.github/workflows/ios.yml` compila la app en una Mac de GitHub. Primero compila para el simulador, lo que verifica el código Swift, y después genera `Entreno-sin-firmar.ipa`. La .ipa se descarga desde la pestaña **Actions → Compilar app iOS → Artifacts**. Para instalarla hay que firmarla con tu Apple ID, con Xcode o con una herramienta de instalación como Sideloadly; Apple no permite saltear la firma.

## Documentación consultada

- Apple — HealthKit: [HKAnchoredObjectQuery](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery), [HKStatisticsCollectionQuery](https://developer.apple.com/documentation/healthkit/hkstatisticscollectionquery), [HKMetadataKeyWasUserEntered](https://developer.apple.com/documentation/healthkit/hkmetadatakeywasuserentered), [authorizationStatus(for:)](https://developer.apple.com/documentation/healthkit/hkhealthstore/authorizationstatus(for:)) (la app no puede saber si se negó la lectura), [Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy), [HKCategoryValueSleepAnalysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis), [Supported capabilities (iOS)](https://developer.apple.com/help/account/reference/supported-capabilities-ios).
- Garmin: desde este entorno `support.garmin.com` no resolvía, así que no pude leer la página oficial. Por fuentes secundarias, Garmin Connect envía a Salud pasos, sueño, FC y actividades, en una sola dirección. Confirmalo en la ayuda de Garmin Connect. No se usa tu contraseña de Garmin ni ninguna integración no oficial.

## Nutrición

- Catálogo local `src/data/foods.ts`: valores aproximados por 100 g, principalmente de **USDA FoodData Central (SR Legacy)**, con el nombre de cada alimento en esa base. Los que no tienen equivalente claro dicen "Estimación aproximada".
- **Varias opciones por comida** (`src/data/menu.ts`): 8 desayunos (incluido bife con huevos duros), 9 almuerzos, 6 meriendas (whey en agua) y 8 cenas, intercambiables. Cada comida muestra calorías, proteínas, carbohidratos y grasas. En Compras o Preparación, el botón "Enviar" comparte el menú, la lista de compras y la preparación con quien cocina.
- **Cenas sin carbohidratos:** carne, pollo o pescado con ensaladas o verduras. Sin arroz, papa, batata, pan, fideos ni legumbres. Los carbohidratos del día van en desayuno, almuerzo y merienda.
- Las opciones solo tienen gramos. Calorías y proteína se **calculan** desde el catálogo. Cada comida está dentro de un rango de calorías parecido (desayuno 520–620, almuerzo 860–960, merienda 480–540, cena 520–600), así que cualquier combinación da un día de ~2.400–2.700 kcal. Los días sugeridos dan 2.509–2.557 kcal y 169–190 g de proteína. Las pruebas lo verifican.
- Sin avena, leche ni maní. Huevo como mucho 4 días de la semana sugerida, siempre con alternativa sin huevo. Queso y yogur solo como opción, desactivada al inicio. Sin suplementos.
- El texto libre no se estima. Podés cargar valores conocidos, que quedan marcados como "cargado por vos".

## Estructura

```
src/lib        lógica: fechas, base de datos, metas, pasos, progresión, nutrición, tendencias, respaldo
src/health     clasificación de fuentes, sueño, sincronización con Salud, interfaz del plugin
src/screens    Hoy, Entrenar, Comidas, Progreso, Ajustes, Salud
src/data       perfil inicial, horario, plantillas de entrenamiento, alimentos, menú
tests/         pruebas unitarias (Vitest + fake-indexeddb)
e2e/           pruebas de punta a punta (Playwright)
ios/           proyecto Xcode (Capacitor) + HealthBridgePlugin.swift
```
