import Capacitor

final class OperatorBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Capacitor 8 crea el bridge con autoRegisterPlugins=true. En ese modo
        // registerPluginType(_:) retorna sin hacer nada: sirve sólo cuando el
        // registro automático está desactivado. Estos plugins viven en el
        // target de la app (no en un paquete), por lo que no aparecen en
        // capacitor.config.json y deben registrarse como instancias.
        bridge?.registerPluginInstance(OperatorWidgetPlugin())
        bridge?.registerPluginInstance(OperatorRelaunchPlugin())
    }
}
