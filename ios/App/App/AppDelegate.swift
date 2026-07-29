import UIKit
import Capacitor

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Rearme del despertador ANTES que nada.
        //
        // Cuando iOS relanza la app por un cambio significativo de ubicación
        // —la única forma de revivir un proceso terminado—, entrega la clave
        // `.location` y hay que volver a pedir la vigilancia de inmediato. Si
        // esto esperara a que cargue el WebView y el proceso muriera antes, la
        // app perdería su único mecanismo de despertar y no volvería nunca.
        let launchedByLocation = launchOptions?[.location] != nil
        OperatorRelaunchMonitor.shared.restoreOnLaunch(launchedByLocation: launchedByLocation)
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(
            name: "Default Configuration",
            sessionRole: connectingSceneSession.role
        )
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
