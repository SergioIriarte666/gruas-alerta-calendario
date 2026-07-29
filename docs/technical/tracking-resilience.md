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

### 4. Relanzamiento tras muerte del proceso, sin transistorsoft

`@transistorsoft/capacitor-background-geolocation` está **descartado** (decisión
del dueño, 2026-07-29) y no hizo falta. El proyecto ya escribía plugins nativos
propios, así que se agregaron dos archivos de Swift al target de la app:

- **`ios/App/App/OperatorRelaunchMonitor.swift`** — envuelve
  `startMonitoringSignificantLocationChanges()`. SLC es el único mecanismo del
  sistema que **relanza una app terminada**: iOS la vuelve a lanzar en segundo
  plano al detectar movimiento y entrega
  `UIApplication.LaunchOptionsKey.location`. Basta con que la grúa empiece a
  rodar para que la app vuelva sola.
- **`ios/App/App/OperatorRelaunchPlugin.swift`** — el puente a JS
  (`arm`, `disarm`, `getLaunchInfo`, `consumeLaunchReason`), registrado en
  `OperatorBridgeViewController.capacitorDidLoad()` igual que
  `OperatorWidgetPlugin`.

Tres decisiones que valen la pena recordar:

1. **El rearme vive en `AppDelegate.didFinishLaunchingWithOptions`, no en el
   plugin.** Cuando iOS relanza por ubicación hay que volver a pedir la
   vigilancia de inmediato; si esperara al WebView y el proceso muriera antes,
   la app perdería su único mecanismo de despertar y no volvería nunca.
2. **El monitor no sube puntos.** Su único trabajo es despertar el proceso; el
   pipeline de JS arranca solo, recupera la sesión activa y rearma el watcher
   fino. Un segundo camino de escritura en nativo habría que mantenerlo en
   paralelo, y ya hubo un incidente por dos watchers peleando la misma sesión.
3. **Se desarma SOLO en el corte manual.** Un fin de sesión por horario o por
   barrido de zombies no significa que el traslado terminó; desarmar ahí dejaría
   al operador sin red justo cuando el sistema acaba de matarle algo.

SLC no reemplaza al watcher: su resolución es de ~500 m y varios minutos. Es la
red que enciende la red buena. Y exige autorización **"Siempre"**: con "Mientras
se usa" el sistema no relanza, así que el monitor ni siquiera se arma.

`app_boot_log.launch_reason` gana el valor `significant_location`, que responde
la pregunta que el 28/07 no se pudo contestar: ¿la app llegó a relanzarse?

Verificado con `xcodebuild -scheme App -sdk iphonesimulator`: **BUILD
SUCCEEDED**. Los dos archivos quedaron registrados en `project.pbxproj`
siguiendo el patrón de `OperatorWidgetPlugin`.

Segunda vía, no implementada y probablemente innecesaria ahora: **push
silencioso** desde el watchdog del Fix 9, con las funciones de push que ya están
desplegadas.

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
- Matar la app → mover el equipo unos cientos de metros → debe relanzarse en
  segundo plano, y `app_boot_log` debe traer `launch_reason =
  'significant_location'`. Requiere permiso de ubicación en **"Siempre"**.
- Watcher mudo forzado (denegar ubicación con la transmisión encendida y
  volver a concederla): a los 5 minutos el vigilante debe re-armar solo, con la
  línea `Captura muda: se re-arma el watcher` en el log.
- `app_boot_log` poblándose; error JS forzado apareciendo en el arranque
  siguiente.
