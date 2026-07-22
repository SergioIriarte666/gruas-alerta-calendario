import Foundation
import Capacitor
import WidgetKit

@objc(OperatorWidgetPlugin)
public class OperatorWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OperatorWidgetPlugin"
    public let jsName = "OperatorWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private let appGroup = "group.cl.gruas5norte.tmsoperador"

    @objc func sync(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            call.reject("No se pudo abrir el contenedor compartido de widgets")
            return
        }

        setService(call.options["nextService"], key: "next_service", defaults: defaults)
        setService(call.options["activeService"], key: "active_service", defaults: defaults)
        defaults.set(call.options["updatedAt"] as? String ?? "", forKey: "updated_at")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            call.reject("No se pudo abrir el contenedor compartido de widgets")
            return
        }

        defaults.removeObject(forKey: "next_service")
        defaults.removeObject(forKey: "active_service")
        defaults.removeObject(forKey: "updated_at")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    private func setService(_ value: Any?, key: String, defaults: UserDefaults) {
        if let service = value as? [String: Any] {
            defaults.set(service, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
