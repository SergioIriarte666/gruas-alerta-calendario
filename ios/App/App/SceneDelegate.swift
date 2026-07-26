import UIKit
import Capacitor

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard scene is UIWindowScene else { return }

        // Store cold-start links before the web app asks Capacitor for the
        // launch URL. Links received while running use the callbacks below.
        connectionOptions.urlContexts.forEach(forwardToCapacitor)
        connectionOptions.userActivities.forEach(forwardToCapacitor)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        URLContexts.forEach(forwardToCapacitor)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forwardToCapacitor(userActivity)
    }

    private func forwardToCapacitor(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [
            .openInPlace: context.options.openInPlace
        ]

        if let sourceApplication = context.options.sourceApplication {
            options[.sourceApplication] = sourceApplication
        }

        if let annotation = context.options.annotation {
            options[.annotation] = annotation
        }

        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: context.url,
            options: options
        )
    }

    private func forwardToCapacitor(_ userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}
