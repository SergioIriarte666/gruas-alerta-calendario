package cl.gruas5norte.tmsoperador;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OperatorWidget")
public class OperatorWidgetPlugin extends Plugin {
    static final String PREFERENCES_NAME = "operator_widget_data";
    static final String NEXT_SERVICE_KEY = "next_service";
    static final String ACTIVE_SERVICE_KEY = "active_service";
    static final String UPDATED_AT_KEY = "updated_at";

    @PluginMethod
    public void sync(PluginCall call) {
        JSObject nextService = call.getObject("nextService", null);
        JSObject activeService = call.getObject("activeService", null);
        String updatedAt = call.getString("updatedAt", "");

        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .edit();

        putService(editor, NEXT_SERVICE_KEY, nextService);
        putService(editor, ACTIVE_SERVICE_KEY, activeService);
        editor.putString(UPDATED_AT_KEY, updatedAt).apply();

        OperatorWidgetRenderer.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getContext()
            .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
        OperatorWidgetRenderer.updateAll(getContext());
        call.resolve();
    }

    private void putService(SharedPreferences.Editor editor, String key, JSObject service) {
        if (service == null) {
            editor.remove(key);
        } else {
            editor.putString(key, service.toString());
        }
    }
}
