package cl.gruas5norte.tmsoperador;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OperatorWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
