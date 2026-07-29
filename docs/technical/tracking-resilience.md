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

## Lo que NO se implementó, y por qué

**Relanzamiento automático tras muerte del proceso** (`stopOnTerminate=false`,
`startOnBoot=true`, Significant Location Change).

`@capacitor-community/background-geolocation` **no expone ninguna de las tres**.
Sus únicas opciones de watcher son `backgroundMessage`, `backgroundTitle`,
`requestPermissions`, `stale` y `distanceFilter`
(`node_modules/@capacitor-community/background-geolocation/definitions.d.ts`).

Conseguirlo exige cambiar a `@transistorsoft/capacitor-background-geolocation`
—licencia comercial, rebuild nativo completo y revalidar todo el pipeline de
tracking—. Es una ronda propia con pruebas en terreno, no un cambio de pasada
sobre el mecanismo del que depende lo que ve el cliente.

Decisión (2026-07-29): **posponer**. El propio diseño de la ronda 4 degrada esta
pieza a capa de conveniencia: el watchdog de servidor avisa a los 10 minutos y
"Reanudar viaje" repara con un toque, sin depender de que iOS relance nada.

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
  espera que NO relance: es la limitación documentada arriba).
- `app_boot_log` poblándose; error JS forzado apareciendo en el arranque
  siguiente.
