## Auditoría de la implementación actual

**Stack:** integración directa con Meta Cloud API (`graph.facebook.com/v18.0`) vía 2 edge functions y `_shared/whatsapp.ts`. Settings en tabla `whatsapp_settings` y UI en `WhatsAppSettingsSection`. Plantillas con `language: es_CL`.

**Puntos disparadores activos:**
- `send-whatsapp-operator` ← `EnhancedServiceForm` (asignación de operador)
- `send-whatsapp-admin` ← `servicio_completado` (VIP), `servicio_sin_cotizacion` (form), `orden_compra` (3 sitios), `cierre_mensual` (form + test)

## Brechas detectadas (de mayor a menor impacto)

1. **Sin log de mensajes**. Disparo fire-and-forget: no se guarda quién, cuándo, a quién, qué plantilla, qué `messageId`, ni el error de Meta. Imposible auditar o reenviar. Solo hay `console.log` en runtime de edge.
2. **Sin webhook de estado de entrega**. Meta envía `sent / delivered / read / failed` por webhook; hoy no se recibe nada → un mensaje "exitoso" para nosotros puede no haber llegado nunca al destinatario.
3. **Sin retry ni circuit-breaker**. Un 429 / 5xx transitorio de Meta = mensaje perdido sin alerta.
4. **Flags de settings huérfanos**. `notify_service_no_operator`, `notify_invoice_overdue`, `notify_daily_reminder` aparecen en la UI y la tabla, pero no existen en `eventToSettingKey` del edge ni hay disparador → toggles que mienten al usuario.
5. **Normalización de teléfono insuficiente** (`_shared/whatsapp.ts:51`). Si llega `""` devuelve `"56"`; si llega `"123"` devuelve `"56123"`. No valida `^569\d{8}$`. Meta acepta y rebota silenciosamente.
6. **Timezone shift en fecha del operador** (`send-whatsapp-operator:90`). Usa `new Date(serviceDate)` directo sobre `YYYY-MM-DD` → corre 1 día (viola la regla `safeParseDateOnly` del Core memory).
7. **`Promise.all` sin agregar resultados parciales**. Si admin_phone_2 falla y admin_phone_1 OK, el cliente igual recibe `{success: true}` y se pierde el fallo.
8. **Sin idempotencia / anti-doble-clic**. Reabrir y guardar un servicio re-envía la asignación al operador.
9. **`send-whatsapp-operator` exige rol `admin`** → si un operador o el sistema (cron, edge a edge) intenta dispararlo, falla con 403. Inconsistente con el resto de la app.
10. **Errores devueltos como `{ success: false, error }`** con el objeto `Error` crudo → al cliente le llega `{}` y el toast queda vacío ("No se pudo enviar..." sin description).
11. **Sin gestión de plantillas desde UI**. Si Meta rechaza/renombra una plantilla, falla en producción sin manera de detectarlo hasta el reclamo del usuario.
12. **Cabecera CORS sin `Access-Control-Allow-Methods`** (menor, pero levanta warnings en algunos navegadores).
13. **Phone test reutiliza plantilla `cierre_mensual`** — funciona pero ensucia métricas y obliga a tener esa plantilla aprobada solo para probar conexión.

## Plan de mejoras

### Fase 1 — Observabilidad y robustez del envío (alto impacto, sin cambios visuales mayores)

**1.1 Tabla `whatsapp_message_log`** (nueva migración con GRANTs + RLS)
```text
id, created_at, direction ('outbound'),
template_name, event, recipient_phone, parameters jsonb,
status ('queued'|'sent'|'delivered'|'read'|'failed'),
provider_message_id, error_code, error_message,
triggered_by (uuid -> auth.uid), context jsonb (folio, serviceId, etc.)
```
RLS: SELECT solo admin; INSERT/UPDATE solo `service_role` (escrito por edges).

**1.2 `_shared/whatsapp.ts` refactor**
- Insertar fila `queued` antes del fetch; al recibir respuesta, `UPDATE` con `sent`/`failed` + `provider_message_id` o detalle de error.
- Retry exponencial (3 intentos, 250ms/750ms/2000ms) para 429 y 5xx; no reintentar 4xx de plantilla.
- Endurecer `normalizeChileanPhone`: validar `^569\d{8}$`, devolver `{ ok, phone, reason }`. Si inválido, marcar log `failed` con `INVALID_PHONE` y no llamar a Meta.
- Devolver siempre `{ success, messageId?, error?: {code, message} }` serializable.

**1.3 Webhook `whatsapp-webhook` (nuevo edge `verify_jwt=false`)**
- GET: verificación del `hub.challenge` con `WHATSAPP_VERIFY_TOKEN` (nuevo secreto).
- POST: actualiza `whatsapp_message_log` por `provider_message_id` con `delivered/read/failed`.
- Documentar URL en chat para configurar en Meta Dashboard.

**1.4 Fix timezone**: usar `safeParseDateOnly` en `send-whatsapp-operator` para formatear `serviceDate`.

**1.5 Fix `Promise.all` agregado**: usar `Promise.allSettled`, devolver `{notified, failed: [{phone, error}]}` y status 207 si hay parcial.

### Fase 2 — Cierre de funcionalidades a medias

**2.1 Cablear flags huérfanos**
- `notify_service_no_operator`: añadir evento `servicio_sin_operador` (template + disparador donde se cree un servicio sin `operatorId`).
- `notify_invoice_overdue`: usar el cron diario existente para detectar facturas vencidas y enviar `admin_pago_pendiente`.
- `notify_daily_reminder`: cron a las 8:00 con resumen del día (cantidad de servicios programados).

**2.2 Idempotencia de asignación al operador**
- En `services` añadir `operator_notified_at timestamptz`. El edge marca tras envío exitoso. El form solo dispara si `operatorId` cambió o `operator_notified_at IS NULL`.

**2.3 Permisos `send-whatsapp-operator`**: aceptar `admin` u `operator`, o validar contra `service.created_by`.

**2.4 Test de conexión**: crear plantilla `test_connection` (1 sola variable) o usar endpoint de Meta de health (`GET /{phone_number_id}`) sin gastar plantilla productiva.

### Fase 3 — UX en `WhatsAppSettingsSection`

- Pestaña "Historial" que consulta `whatsapp_message_log` (últimos 50, filtro por estado).
- Badge de estado por flag indicando si la plantilla correspondiente está mapeada y aprobada.
- Validación visual de RUT/teléfono en `adminPhone1/2` (formato chileno).
- Mostrar último error de Meta cuando `connectionStatus === 'error'`.

## Fuera de alcance (decisión explícita)

- No migrar a un proveedor distinto (Twilio, etc.). Memory `whatsapp-meta-direct-decision` lo veta.
- No habilitar mensajes entrantes / chatbot — solo notificaciones salientes.
- No reescribir las UIs de los disparadores: solo añadir guardas de idempotencia mínimas.

## Sugerencia de orden de ejecución

Recomiendo arrancar por **Fase 1.1 + 1.2 + 1.4 + 1.5** (1 migración + refactor de 3 archivos): da observabilidad inmediata y arregla los bugs reales. Luego decidir si seguir con webhook (Fase 1.3) y los flags huérfanos (Fase 2). ¿Avanzo con la Fase 1 completa, o prefieres priorizar otra parte primero?
