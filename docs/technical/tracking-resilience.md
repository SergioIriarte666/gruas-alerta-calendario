# Resiliencia de la transmisión del operador

Estado al 2026-07-29, después de la ronda 4.

## El episodio que originó esto

28/07, folio 3262047-1. Con la app nativa instalada y el latido operando (90
puntos `source='heartbeat'` ese día), la transmisión murió a las 15:26 durante
una espera de tres horas en un corte de ruta y no revivió al retomar. El
operador no cerró la app ni apagó el teléfono.

El dato que orientó el diagnóstico: **cero puntos con subida tardía y cero
`is_offline_sync` después de las 15:26**. Durante el apagón no se encoló nada.
Eso descarta "la red se cayó y la cola aguantó" y deja dos candidatos: murió la
captura, o murió la app entera.

Hipótesis principal del dueño, con síntoma conocido en su flota: interrupción de
datos móviles por **llamadas de voz**. En redes sin VoLTE —o con el teléfono
caído a 3G por cobertura débil, agravado por una celda saturada de cientos de
vehículos detenidos en el corte— los datos se suspenden por completo durante la
llamada. Esa tarde hubo varias llamadas con el operador.

## Qué se implementó

### 1. La captura no puede morir por una falla de red

`src/services/locationUploadQueue.ts`. El watcher entrega el punto a una cola
persistente en almacenamiento **nativo** (`@capacitor/preferences` → UserDefaults
/ SharedPreferences, sobrevive a que el sistema mate el proceso) y devuelve el
control de inmediato. Un uploader independiente la vacía con reintento y backoff
exponencial (2 s → 2 min). Un error HTTP se loguea y se reintenta; **nunca sube
por la pila hasta el watcher**.

Antes, el callback de captura intentaba subir en línea y además barría la cola
entera dentro del mismo camino: con la red muerta, eso eran cientos de
peticiones colgadas por minuto dentro del propio callback.

`is_offline_sync` se conserva como dato forense: un punto que esperó detrás de
un barrido fallido viaja marcado (`delayed`), y uno que sube al primer intento
no. Es lo que permite decir, mirando la base al día siguiente, si lo que murió
fue la captura o la subida.

### 2. Autopsia del arranque

Tabla `app_boot_log` (migración `20260729120000`): una fila por arranque con
`launch_reason`, `app_version`, `platform`, `pending_points` y `last_error`.

El error fatal **viaja en el arranque siguiente**: cuando la app muere en
terreno, muchas veces el error ES que no hay red, así que se persiste local
(`src/native/fatalErrorStore.ts`, sin importar nada pesado porque lo carga
`main.tsx` en el camino crítico) y se sube cuando la app vuelve a abrir.

`pending_points` es la pregunta que el 28/07 no se pudo responder: con la cola
llena murió la SUBIDA; con la cola vacía y un hueco en el recorrido, murió la
CAPTURA.

### 3. Red de seguridad de servidor y recuperación en un toque

Ver Fix 9 (`enqueue_tracking_silence_alerts`, cron cada 5 min) y Fix 10 (botón
"Reanudar viaje" con deep link `/operador?accion=reanudar`). Son las capas de
las que la operación depende de verdad; lo de arriba es conveniencia.

### 3. Vigilante de la captura, en el teléfono

**La pieza más importante, y la que casi se pierde por un diagnóstico apurado.**

`hasLiveCapture()` significaba "tengo un `activeWatcherId`". Ese id solo se
limpia en `teardownCapture()`, así que un watcher que dejó de entregar fixes
—por lo que sea— seguía contando como vivo, y la auto-reparación de
`reconcileWithSession` ("sesión activa sin watcher: se re-engancha") **nunca se
disparaba**.

Eso cuadra exactamente con la evidencia del 28/07: app viva, sesión viva, cero
puntos, **cola vacía** (no se capturó nada que encolar) y ninguna recuperación
en dos horas.

Ahora la vida del watcher se mide por hechos: `markCaptureAlive()` en cada fix,
`markCaptureFailed()` en cada error, y `isCaptureStalled()` declara muerto al
que lleva 5 minutos mudo. `rearmStalledCapture()` corre en el tick de 30 s,
**antes de reconciliar y sin tocar la red** —en un corte de tres horas sin datos,
cualquier reparación que necesite servidor no se ejecuta—, con un piso de 60 s
entre re-armados para que reparar no se vuelva un bucle.

La virtud del enfoque es que **no depende de adivinar la causa**: cubre el error
de CoreLocation, el watcher que iOS deja de alimentar, el puente que perdió el
callback y lo que todavía no sabemos que puede pasar.

## Lo que se leyó del plugin, y qué hipótesis mató

Del Swift de `@capacitor-community/background-geolocation`
(`ios/Plugin/Swift/Plugin.swift`):

- `pausesLocationUpdatesAutomatically = false`. **Descarta** la hipótesis de que
  iOS pausara las actualizaciones tras tres horas detenido.
- `allowsBackgroundLocationUpdates` se activa cuando se pasa `backgroundMessage`,
  que sí se pasa. Correcto.
- Ante `CLError.denied`, el plugin llama `watcher.stop()` —o sea
  `stopUpdatingLocation()`— y solo revive con un cambio de autorización. Sin
  re-armar desde JS, ese watcher queda muerto para siempre con su id intacto.
- **No llama a `startMonitoringSignificantLocationChanges` en ninguna parte.**
  Ahí sí se confirma que no hay relanzamiento tras terminación.

Descartado por comprobación, no por intuición: un `call.reject` **no** libera el
callback. Ni `toJsError` en `CapacitorBridge.swift` ni `returnResult` en
`native-bridge.js` borran la llamada guardada cuando es un callback (sí cuando
es una promesa). El puente sobrevive al error.

## Relanzamiento tras muerte del proceso: pendiente, sin transistorsoft

`@transistorsoft/capacitor-background-geolocation` está **descartado** (decisión
del dueño, 2026-07-29). No hace falta: el proyecto ya escribe plugins nativos
propios —`ios/App/App/OperatorWidgetPlugin.swift`, registrado en el target de la
app, no en SPM—, así que un plugin local de ~40 líneas de Swift que llame a
`startMonitoringSignificantLocationChanges` da el mismo relanzamiento, gratis y
sin licencia. `UIBackgroundModes` ya incluye `location`.

Segunda vía, con infraestructura que ya existe: **push silencioso** desde el
watchdog del Fix 9. El servidor ya detecta el silencio a los 10 minutos; un
push `content-available` puede despertar la app terminada por el sistema y
re-armar el rastreo. Hay funciones de push desplegadas
(`send-push-notification`, `save-push-subscription`).

Ninguna de las dos se implementó todavía. Con el vigilante de captura arriba, la
mayor parte del agujero real queda cubierta sin tocar nada nativo.

## Mitigación operativa, sin código

Para el manual del operador:

1. **Conectar el teléfono al WiFi Starlink de la grúa durante el servicio.** El
   WiFi no se interrumpe por llamadas de voz: inmuniza contra este modo de falla
   por completo. Las grúas tienen Starlink permanente energizado directo a
   batería.
2. **Verificar VoLTE activo** en los teléfonos de la flota: Ajustes → Datos
   móviles → Opciones → Voz y datos → LTE/VoLTE.

## Pruebas que faltan, en dispositivo

Requieren el rebuild iOS pendiente:

- Modo avión 10 min con transmisión activa → la captura continúa y, al
  reconectar, los puntos suben en lote con `is_offline_sync=true` sin fragmentar
  la sesión.
- Matar la app → mover el equipo → comprobar qué ocurre (con este plugin, se
  espera que NO relance hasta que exista el plugin local de SLC).
- Watcher mudo forzado (denegar ubicación con la transmisión encendida y
  volver a concederla): a los 5 minutos el vigilante debe re-armar solo, con la
  línea `Captura muda: se re-arma el watcher` en el log.
- `app_boot_log` poblándose; error JS forzado apareciendo en el arranque
  siguiente.
