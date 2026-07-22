# Widgets de Portal Operador

La app móvil publica dos widgets nativos:

- **Próximo servicio:** muestra el primer servicio pendiente por fecha y hora.
- **Servicio activo:** muestra el servicio que está en curso.

Ambos muestran folio, horario y ruta. Al tocarlos abren Portal Operador en la sección correspondiente. La información se actualiza cuando la app recibe o refresca los servicios y se elimina al cerrar o expirar la sesión.

## Arquitectura

La capa web genera un resumen mínimo mediante `src/native/operatorWidget.ts`. El plugin nativo guarda ese resumen en almacenamiento local y solicita el refresco de los widgets:

- iOS usa el App Group `group.cl.gruas5norte.tmsoperador` y WidgetKit.
- Android usa `SharedPreferences` privados y dos `AppWidgetProvider`.

Los widgets no consultan Supabase directamente ni almacenan credenciales. iOS marca la ruta como información sensible para ocultarla cuando el sistema aplique protección de privacidad.

## Preparación de una versión móvil

```sh
npm run build:operator-mobile
npx cap copy ios
npx cap copy android
```

Para distribuir iOS, la app y la extensión `TMSOperatorWidgets` deben tener habilitado el mismo App Group en firma y capacidades. El proyecto ya contiene los entitlements; Xcode puede requerir actualizar los perfiles de aprovisionamiento de la cuenta del equipo.

## Uso

- iOS: mantener pulsada la pantalla de inicio, pulsar `+`, buscar **TMS Operador** y elegir uno de los dos widgets.
- Android: mantener pulsada la pantalla de inicio, abrir **Widgets**, buscar **TMS Operador** y arrastrar el widget deseado.
