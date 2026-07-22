package cl.gruas5norte.tmsoperador;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

final class OperatorWidgetRenderer {
    private OperatorWidgetRenderer() {}

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        updateProvider(context, manager, NextServiceWidgetProvider.class, false);
        updateProvider(context, manager, ActiveServiceWidgetProvider.class, true);
    }

    static void updateProvider(
        Context context,
        AppWidgetManager manager,
        Class<?> providerClass,
        boolean active
    ) {
        int[] widgetIds = manager.getAppWidgetIds(new ComponentName(context, providerClass));
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, createViews(context, active));
        }
    }

    static RemoteViews createViews(Context context, boolean active) {
        int layoutId = active ? R.layout.widget_active_service : R.layout.widget_next_service;
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
        SharedPreferences preferences = context.getSharedPreferences(
            OperatorWidgetPlugin.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        );
        String key = active ? OperatorWidgetPlugin.ACTIVE_SERVICE_KEY : OperatorWidgetPlugin.NEXT_SERVICE_KEY;
        String rawService = preferences.getString(key, null);

        if (rawService == null) {
            bindEmptyState(views, active);
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, "tmsoperador://operator", active));
            return views;
        }

        try {
            JSONObject service = new JSONObject(rawService);
            String date = formatDate(service.optString("date"));
            String time = formatTime(service.optString("time"));
            String compactDate = compact(date);
            String compactTime = compact(time);
            String schedule = compactDate.isEmpty()
                ? compactTime
                : compactTime.isEmpty() ? compactDate : compactDate + " · " + compactTime;
            String route = service.optString("origin", "Origen pendiente")
                + "  →  "
                + service.optString("destination", "Destino pendiente");

            views.setViewVisibility(R.id.widget_empty, View.GONE);
            views.setViewVisibility(R.id.widget_content, View.VISIBLE);
            views.setTextViewText(R.id.widget_folio, service.optString("folio", "Servicio"));
            views.setTextViewText(R.id.widget_schedule, schedule.isEmpty() ? "Horario pendiente" : schedule);
            views.setTextViewText(R.id.widget_route, route);
            String deepLink = service.optString(
                "deepLink",
                active ? "tmsoperador://operator/active" : "tmsoperador://operator"
            );
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, deepLink, active));
        } catch (JSONException exception) {
            bindEmptyState(views, active);
            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, "tmsoperador://operator", active));
        }

        return views;
    }

    private static void bindEmptyState(RemoteViews views, boolean active) {
        views.setViewVisibility(R.id.widget_content, View.GONE);
        views.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        views.setTextViewText(
            R.id.widget_empty,
            active ? "No hay un servicio activo" : "No hay servicios próximos"
        );
    }

    private static PendingIntent openAppIntent(Context context, String deepLink, boolean active) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, active ? 2002 : 2001, intent, flags);
    }

    private static String formatDate(String value) {
        if (value == null || value.isEmpty()) return "";
        try {
            SimpleDateFormat source = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            SimpleDateFormat output = new SimpleDateFormat("dd/MM", new Locale("es", "CL"));
            Date parsed = source.parse(value);
            return parsed == null ? value : output.format(parsed);
        } catch (ParseException exception) {
            return value;
        }
    }

    private static String formatTime(String value) {
        if (value == null || value.isEmpty()) return "";
        return value.length() >= 5 ? value.substring(0, 5) : value;
    }

    private static String compact(String value) {
        return value == null ? "" : value.trim();
    }
}
