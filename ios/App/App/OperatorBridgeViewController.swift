import Capacitor

final class OperatorBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(OperatorWidgetPlugin.self)
        bridge?.registerPluginType(OperatorRelaunchPlugin.self)
    }
}
