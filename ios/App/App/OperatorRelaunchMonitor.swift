import Foundation
import CoreLocation

/**
 Relanzamiento de la app tras la muerte del proceso.

 El 28/07/2026 la transmisión del folio 3262047-1 murió a las 15:26 durante una
 espera de tres horas en un corte de ruta y no revivió al retomar. El watcher de
 ubicación normal no sobrevive a que iOS termine el proceso: cuando eso pasa, no
 queda nadie que pueda encender nada.

 Los cambios significativos de ubicación (SLC) son el único mecanismo del
 sistema que **relanza una app terminada**: iOS la vuelve a lanzar —en segundo
 plano— al detectar que el equipo se movió, y entrega
 `UIApplication.LaunchOptionsKey.location` en el arranque. Basta con que la grúa
 empiece a rodar para que la app vuelva sola.

 Deliberadamente NO sube puntos desde acá. Su único trabajo es despertar el
 proceso; el pipeline de JS arranca solo, recupera la sesión activa y vuelve a
 armar el watcher fino. Duplicar la subida en nativo sería un segundo camino de
 escritura que habría que mantener en paralelo, y ya hubo un incidente por dos
 watchers peleando la misma sesión.

 SLC no reemplaza al watcher: su resolución es de ~500 m y varios minutos. Es la
 red que enciende la red buena.
 */
final class OperatorRelaunchMonitor: NSObject, CLLocationManagerDelegate {

    static let shared = OperatorRelaunchMonitor()

    /// Debe seguir armado tras un reinicio: la decisión sobrevive al proceso.
    private static let armedKey = "operator_relaunch_armed"
    /// Momento del último relanzamiento por ubicación, para la autopsia.
    private static let launchedByLocationAtKey = "operator_relaunch_launched_at"
    /// Último despertar entregado por SLC, esté o no relanzada la app.
    private static let lastWakeAtKey = "operator_relaunch_last_wake_at"

    private let manager = CLLocationManager()
    private let defaults = UserDefaults.standard
    private var isMonitoring = false

    private override init() {
        super.init()
        manager.delegate = self
        // SLC no usa GPS fino; pedir precisión alta acá solo gastaría batería
        // sin mejorar nada, porque el sistema decide cuándo entregar el evento.
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.pausesLocationUpdatesAutomatically = false
    }

    var isArmed: Bool {
        defaults.bool(forKey: Self.armedKey)
    }

    /**
     Empieza a vigilar los cambios significativos y recuerda la decisión.

     Idempotente: llamarlo dos veces no abre dos vigilancias. iOS permite una
     sola por app, y volver a llamar a `start...` sobre una activa es inofensivo
     pero conviene no depender de ello.
     */
    func arm() {
        defaults.set(true, forKey: Self.armedKey)
        startMonitoring()
    }

    /**
     Deja de vigilar. Se llama SOLO cuando el operador corta la transmisión a
     mano: mientras haya un traslado en curso, el relanzamiento tiene que
     sobrevivir a todo, incluido un cierre forzado por el sistema.
     */
    func disarm() {
        defaults.set(false, forKey: Self.armedKey)
        if isMonitoring {
            manager.stopMonitoringSignificantLocationChanges()
            isMonitoring = false
        }
    }

    /**
     Rearme en el arranque, desde `didFinishLaunchingWithOptions`.

     Va en el AppDelegate y no en el plugin de Capacitor a propósito: cuando iOS
     relanza por ubicación, hay que volver a pedir la vigilancia de inmediato,
     sin esperar a que cargue el WebView. Si el proceso muriera antes de que
     JavaScript llegue a hablar, la app perdería su único mecanismo de
     despertar y ya no volvería nunca.
     */
    func restoreOnLaunch(launchedByLocation: Bool) {
        if launchedByLocation {
            defaults.set(Date().timeIntervalSince1970, forKey: Self.launchedByLocationAtKey)
        }
        guard isArmed else { return }
        startMonitoring()
    }

    /// Datos de arranque para la autopsia (`app_boot_log`).
    func launchInfo() -> [String: Any] {
        var info: [String: Any] = ["armed": isArmed]
        if let launchedAt = defaults.object(forKey: Self.launchedByLocationAtKey) as? Double {
            info["launchedByLocationAt"] = launchedAt * 1000
        }
        if let wakeAt = defaults.object(forKey: Self.lastWakeAtKey) as? Double {
            info["lastWakeAt"] = wakeAt * 1000
        }
        return info
    }

    /// El motivo del arranque se consume una vez: no debe teñir el siguiente.
    func clearLaunchReason() {
        defaults.removeObject(forKey: Self.launchedByLocationAtKey)
    }

    private func startMonitoring() {
        guard CLLocationManager.significantLocationChangeMonitoringAvailable() else { return }
        // SLC en segundo plano exige autorización "Siempre". Con "Mientras se
        // usa" el sistema no relanza, así que armarlo sería una promesa falsa.
        guard manager.authorizationStatus == .authorizedAlways else { return }
        guard !isMonitoring else { return }

        manager.startMonitoringSignificantLocationChanges()
        isMonitoring = true
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        // Solo se deja constancia. Quien captura y sube es el pipeline de JS.
        defaults.set(Date().timeIntervalSince1970, forKey: Self.lastWakeAtKey)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Sin reacción a propósito: SLC se recupera solo y un rearme acá
        // competiría con el vigilante de captura del lado de JavaScript.
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // La autorización "Siempre" puede llegar después de armar (el operador
        // la concede desde Ajustes). Cuando llega, se aprovecha.
        if isArmed { startMonitoring() }
    }
}
