# operador_telemetria_caida

**Estado: PENDIENTE DE CREAR EN META BUSINESS MANAGER.** Hasta que esté
aprobada, el watchdog encola la alerta y el envío falla con error de plantilla
inexistente; el aviso al admin en la campana del TMS sale igual, porque no
depende de Meta.

- Nombre: `operador_telemetria_caida`
- Idioma: es_CL — Categoría: Utility
- Header: sin header
- Cuerpo: "Hola {{1}}, el seguimiento del servicio {{2}} dejó de reportar hace {{3}} minutos. Abre la app TMS y verifica la transmisión."
- Ejemplo: Jesús / 3262047-1 / 12

## Botón (obligatorio)

Es lo que convierte el aviso en una reparación de un toque. Sin el botón, el
operador recibe una instrucción y tiene que navegar a mano.

- Tipo: **URL dinámica**
- Texto del botón: `Reanudar viaje`
- URL: `https://app.gruas5norte.cl/operador?accion={{1}}`
- Ejemplo del parámetro: `reanudar`

El parámetro lo manda `process-notification-outbox` como
`RESUME_TRIP_BUTTON_PARAM`. La ruta `/operador` es un alias en castellano de
`/operator` que conserva la query (`OperatorSpanishAlias` en `src/App.tsx`), y
`TransmissionControl` enfoca el botón "Reanudar viaje" al aterrizar.

## Quién lo dispara

`enqueue_tracking_silence_alerts()`, desde el cron `tracking-silence-watchdog`
(cada 5 min). Condiciones: servicio en traslado (`in_progress` /
`inspection_completed`), link de cliente vigente y entregado, y 10 minutos sin
un solo punto —20 si hay una detención abierta que explique la falta de
movimiento—. Un aviso por episodio.
