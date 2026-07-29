import Foundation
import Capacitor

/**
 Puente de JavaScript hacia `OperatorRelaunchMonitor`.

 Mismo patrón que `OperatorWidgetPlugin`: vive en el target de la app y se
 registra a mano en `OperatorBridgeViewController.capacitorDidLoad()`.

 El plugin es apenas la puerta. La lógica y, sobre todo, el rearme del arranque
 viven en el monitor, porque tienen que correr aunque el WebView nunca llegue a
 cargar.
 */
@objc(OperatorRelaunchPlugin)
public class OperatorRelaunchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OperatorRelaunchPlugin"
    public let jsName = "OperatorRelaunch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "arm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLaunchInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeLaunchReason", returnType: CAPPluginReturnPromise)
    ]

    @objc func arm(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            OperatorRelaunchMonitor.shared.arm()
            call.resolve(["armed": OperatorRelaunchMonitor.shared.isArmed])
        }
    }

    @objc func disarm(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            OperatorRelaunchMonitor.shared.disarm()
            call.resolve(["armed": OperatorRelaunchMonitor.shared.isArmed])
        }
    }

    @objc func getLaunchInfo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(OperatorRelaunchMonitor.shared.launchInfo())
        }
    }

    @objc func consumeLaunchReason(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            OperatorRelaunchMonitor.shared.clearLaunchReason()
            call.resolve()
        }
    }
}
