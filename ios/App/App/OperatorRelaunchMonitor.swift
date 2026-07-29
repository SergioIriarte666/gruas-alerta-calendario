import Foundation
import CoreLocation
import UIKit

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

    /**
     Ventana en la que se mantiene viva la captura fina tras un relanzamiento.

     Tras despertar por ubicación, iOS concede muy poco tiempo de ejecución. Con
     `startUpdatingLocation` y actualizaciones en segundo plano habilitadas, el
     proceso se sostiene mientras el WebView carga, restaura la sesión de
     Supabase y arma su propio watcher. Sin este puente, la app podía volver a
     suspenderse antes de que JavaScript alcanzara a existir: se despertaba y no
     servía de nada.
     */
    private static let launchBridgeSeconds: TimeInterval = 90

    private let manager = CLLocationManager()
    /**
     Manager separado para el puente de arranque.

     Uno solo no sirve: SLC y `startUpdatingLocation` tienen configuraciones de
     precisión distintas y apagar el segundo no puede arrastrar al primero, que
     es el que debe seguir vigilando para siempre.
     */
    private let bridgeManager = CLLocationManager()
    private let defaults = UserDefaults.standard
    private var monitoring = false
    private var bridgeActive = false
    private var bridgeTimer: Timer?

    private override init() {
        super.init()
        manager.delegate = self
        // SLC no usa GPS fino; pedir precisión alta acá solo gastaría batería
        // sin mejorar nada, porque el sistema decide cuándo entregar el evento.
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.pausesLocationUpdatesAutomatically = false

        bridgeManager.delegate = self
        bridgeManager.desiredAccuracy = kCLLocationAccuracyBest
        bridgeManager.pausesLocationUpdatesAutomatically = false
    }

    var isArmed: Bool {
        defaults.bool(forKey: Self.armedKey)
    }

    /// ¿La vigilancia está REALMENTE corriendo, no solo pedida?
    var isMonitoring: Bool { monitoring }

    /**
     Empieza a vigilar los cambios significativos y recuerda la decisión.

     Devuelve si la vigilancia quedó CORRIENDO, que no es lo mismo que haberla
     pedido. Antes marcaba `armed = true` antes de comprobar nada, así que la app
     podía informar "protegido" con permiso "Mientras se usa" —con el que iOS
     no relanza— y la promesa era falsa justo donde más caro sale.

     El estado persistido se conserva aunque el arranque falle: si el operador
     concede "Siempre" más tarde desde Ajustes, `locationManagerDidChangeAuthorization`
     lo aprovecha sin que nadie tenga que volver a pedirlo.
     */
    @discardableResult
    func arm() -> Bool {
        defaults.set(true, forKey: Self.armedKey)
        startMonitoring()
        // El WebView está vivo y va a armar su propio watcher: el puente de
        // arranque ya cumplió y deja de gastar batería.
        endLaunchBridge()
        return monitoring
    }

    /**
     Deja de vigilar. Se llama SOLO cuando el operador corta la transmisión a
     mano: mientras haya un traslado en curso, el relanzamiento tiene que
     sobrevivir a todo, incluido un cierre forzado por el sistema.
     */
    func disarm() {
        defaults.set(false, forKey: Self.armedKey)
        endLaunchBridge()
        if monitoring {
            manager.stopMonitoringSignificantLocationChanges()
            monitoring = false
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

        // Relanzados por ubicación: sostener el proceso hasta que JavaScript
        // pueda hacerse cargo. Es la diferencia entre despertar y servir.
        if launchedByLocation {
            beginLaunchBridge()
        }
    }

    /**
     Estado real de la protección, para la autopsia y para la UI.

     Tres requisitos independientes, y los tres tienen que cumplirse para que
     iOS relance de verdad. Se exponen por separado en vez de un booleano
     porque cada uno se arregla en un lugar distinto de los Ajustes, y el
     operador necesita saber cuál le falta.
     */
    func launchInfo() -> [String: Any] {
        var info: [String: Any] = [
            "armed": isArmed,
            // Lo que se pidió vs. lo que efectivamente corre.
            "monitoring": monitoring,
            "authorizationStatus": Self.describe(manager.authorizationStatus),
            // Sin "Actualización en segundo plano" iOS NO relanza por ubicación,
            // por más permiso "Siempre" que haya.
            "backgroundRefreshStatus": Self.describe(UIApplication.shared.backgroundRefreshStatus),
            "available": CLLocationManager.significantLocationChangeMonitoringAvailable()
        ]
        if let launchedAt = defaults.object(forKey: Self.launchedByLocationAtKey) as? Double {
            info["launchedByLocationAt"] = launchedAt * 1000
        }
        if let wakeAt = defaults.object(forKey: Self.lastWakeAtKey) as? Double {
            info["lastWakeAt"] = wakeAt * 1000
        }
        return info
    }

    private static func describe(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "whenInUse"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private static func describe(_ status: UIBackgroundRefreshStatus) -> String {
        switch status {
        case .available: return "available"
        case .denied: return "denied"
        case .restricted: return "restricted"
        @unknown default: return "unknown"
        }
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
        guard !monitoring else { return }

        manager.startMonitoringSignificantLocationChanges()
        monitoring = true
    }

    /**
     Sostiene el proceso recién despertado con captura fina en segundo plano.

     No sube nada —el pipeline de JS sigue siendo el único que escribe—: lo que
     compra es TIEMPO DE EJECUCIÓN. Se apaga solo a los 90 segundos, o antes si
     JavaScript llama a `arm()`, que es la señal de que ya tomó el control.
     */
    private func beginLaunchBridge() {
        guard !bridgeActive else { return }
        guard bridgeManager.authorizationStatus == .authorizedAlways else { return }

        bridgeManager.allowsBackgroundLocationUpdates = true
        bridgeManager.startUpdatingLocation()
        bridgeActive = true

        bridgeTimer?.invalidate()
        bridgeTimer = Timer.scheduledTimer(
            withTimeInterval: Self.launchBridgeSeconds,
            repeats: false
        ) { [weak self] _ in
            self?.endLaunchBridge()
        }
    }

    private func endLaunchBridge() {
        bridgeTimer?.invalidate()
        bridgeTimer = nil
        guard bridgeActive else { return }
        bridgeManager.stopUpdatingLocation()
        bridgeManager.allowsBackgroundLocationUpdates = false
        bridgeActive = false
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard manager === self.manager else { return }

        defaults.set(Date().timeIntervalSince1970, forKey: Self.lastWakeAtKey)

        // Despertar con la app en segundo plano es el caso que importa: iOS nos
        // dio unos segundos y hay que estirarlos hasta que JavaScript arranque.
        // En primer plano no hace falta, la app ya está viva.
        if UIApplication.shared.applicationState != .active {
            beginLaunchBridge()
        }
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
