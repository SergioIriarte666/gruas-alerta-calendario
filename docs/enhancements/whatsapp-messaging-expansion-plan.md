# Plan de expansión de mensajería WhatsApp

## Resumen

Este documento consolida la **planificación funcional y técnica** para expandir la mensajería WhatsApp del sistema TMS Grúas más allá del alcance actual de `operadores` y `admins`, incorporando gradualmente `clientes` y `proveedores`.

El objetivo es crecer con una estrategia **transaccional, operativa y de bajo volumen**, priorizando trazabilidad, simplicidad, control y escalabilidad.

Este documento es de **planificación**. No implica implementación inmediata.

---

## Estado actual

La base actual ya contempla:

- integración con **Meta WhatsApp Cloud API**
- uso de **Supabase Edge Functions**
- webhook de estados de entrega/lectura
- logs e historial de mensajes
- plantillas para operadores y admins

La habilitación total en producción todavía depende del cierre completo del proceso de verificación en Meta.

Alcance operativo actual confirmado:

- `operadores`: notificación por asignación y reenvío manual desde UI
- `admins`: alertas operativas y administrativas
- `clientes` y `proveedores`: planificados, aún fuera del alcance operativo actual

Documento relacionado:

- `docs/guia-configuracion-whatsapp.md`

---

## Objetivo de la expansión

Expandir la capacidad de mensajería hacia:

- `operadores` con mayor cobertura operativa
- `clientes` para estados clave del servicio
- `proveedores` para coordinación y órdenes de compra

La expansión debe cumplir estos objetivos:

- reducir llamadas de seguimiento
- mejorar coordinación operativa
- mantener mensajes claros y accionables
- evitar lógica duplicada en frontend
- dejar trazabilidad completa por evento

---

## Principios de diseño

- modelar la mensajería por **eventos de negocio**, no por pantallas
- separar claramente `destinatario`, `trigger`, `plantilla`, `canal` y `contexto`
- mantener foco en mensajes **transaccionales**, no comerciales
- registrar envíos exitosos, omitidos y fallidos
- escalar por fases pequeñas con pocas plantillas por etapa

---

## Roadmap por fases

## Fase 1 — Consolidación operadores y admins

Objetivo:

- estabilizar y validar la base actual antes de abrir nuevos destinatarios

Alcance:

- envío automático al operador al asignar o crear servicio con operador
- alertas administrativas vigentes
- validación de webhook, logs y errores operativos
- capacidad de reenvío manual desde UI

Criterios de aceptación:

- el operador recibe mensajes en productivo una vez completada la verificación de Meta
- el sistema informa si el envío fue omitido por configuración, falta de teléfono o error de validación
- el historial refleja estados `sent`, `delivered`, `read` o `failed`
- los reenvíos manuales quedan trazables

## Fase 2 — Clientes

Objetivo:

- reducir incertidumbre operativa y llamadas de seguimiento mediante mensajes transaccionales de alto valor

Alcance propuesto:

- confirmación de servicio
- modificación relevante del servicio
- cancelación del servicio
- recordatorio previo al servicio

Lineamientos:

- no incluir mensajes comerciales o promocionales
- no incluir cobranza en la primera ola
- priorizar mensajes cortos, claros y orientados a la operación

Criterios de aceptación:

- cada evento cuenta con plantilla aprobada
- el sistema solo envía si existe teléfono válido y datos mínimos requeridos
- cada mensaje queda trazado por servicio, cliente y estado
- los cambios no relevantes no generan notificaciones

## Fase 3 — Proveedores

Objetivo:

- mejorar coordinación operativa y documental vinculada a órdenes de compra

Alcance propuesto:

- orden de compra emitida
- solicitud de confirmación
- seguimiento de pendientes

Estrategia:

- comenzar con disparo manual o semi-manual
- automatizar solo cuando el flujo esté validado operacionalmente

Criterios de aceptación:

- cada mensaje se asocia a una orden o contexto claro
- los proveedores reciben información breve y accionable
- el sistema deja trazabilidad suficiente para soporte y seguimiento

## Fase 4 — Capa unificada de mensajería

Objetivo:

- consolidar un modelo escalable para múltiples destinatarios y eventos, evitando lógica duplicada

Alcance conceptual:

- catálogo de destinatarios
- preferencias por evento y canal
- mapeo centralizado entre eventos y plantillas
- historial unificado de despachos
- eventual cola de mensajes y reintentos controlados

Criterios de aceptación:

- el frontend no depende del nombre de la plantilla
- el backend resuelve destinatario, validaciones y plantilla
- el modelo sirve para operadores, clientes, proveedores y admins sin rediseño estructural

---

## Matriz base de eventos

| Evento | Entidad origen | Destinatario | Tipo | Trigger | Plantilla | Datos requeridos | Prioridad | Fase |
|---|---|---|---|---|---|---|---|---|
| `service_assigned` | Servicio | Operador | Automático | Asignación de operador | `servicio_asignado` | folio, operador, fecha, origen, destino, cliente, teléfono cliente | Alta | 1 |
| `service_completed` | Servicio | Admin | Automático | Cambio a completado | `admin_servicio_completado` | folio, operador, cliente, fecha cierre | Alta | 1 |
| `service_no_quote` | Servicio | Admin | Automático | Creación sin valor/cotización | `admin_servicio_sin_cotizacion` | folio, cliente, fecha servicio | Alta | 1 |
| `purchase_order_created` | Servicio / OC | Admin | Manual/Automático | Registro de OC | `admin_orden_compra` | proveedor/cliente, monto, descripción | Media | 1 |
| `daily_summary` | Operación diaria | Admin | Automático programado | Job diario | `admin_resumen_diario` | fecha, servicios del día, pendientes | Media | 1 |
| `service_confirmation` | Servicio | Cliente | Automático | Confirmación de creación/agendamiento | futura plantilla cliente | nombre cliente, folio, fecha, origen, destino | Alta | 2 |
| `service_updated` | Servicio | Cliente | Automático | Cambio relevante | futura plantilla cliente actualización | folio, campos modificados, nueva fecha/hora/origen/destino | Alta | 2 |
| `service_updated` | Servicio | Operador | Automático | Cambio relevante | futura plantilla operador actualización | folio, nueva fecha/hora/origen/destino | Alta | 2 |
| `service_cancelled` | Servicio | Cliente | Automático | Cancelación | futura plantilla cliente cancelación | folio, fecha, motivo resumido | Alta | 2 |
| `service_cancelled` | Servicio | Operador | Automático | Cancelación | futura plantilla operador cancelación | folio, fecha, motivo resumido | Alta | 2 |
| `service_reminder` | Servicio | Cliente | Automático programado | Recordatorio previo | futura plantilla cliente recordatorio | nombre, folio, fecha, hora, origen | Media | 2 |
| `service_reminder` | Servicio | Operador | Automático programado | Recordatorio previo | futura plantilla operador recordatorio | operador, folio, fecha, origen, destino | Media | 2 |
| `arrival_notice` | Servicio | Cliente | Manual/Automático | Operador en ruta / llegada | futura plantilla cliente llegada | folio, operador, ETA o estado | Media | 2 |
| `supplier_purchase_order` | Orden de compra | Proveedor | Manual/Automático | Emisión de OC | futura plantilla proveedor OC | proveedor, número OC, monto, descripción, fecha | Alta | 3 |
| `supplier_follow_up` | Orden de compra | Proveedor | Manual | Seguimiento administrativo | futura plantilla proveedor seguimiento | número OC, estado, mensaje corto | Media | 3 |
| `supplier_confirmation_request` | Orden de compra | Proveedor | Manual/Automático | Solicitud de confirmación | futura plantilla proveedor confirmación | número OC, fecha, detalle breve | Media | 3 |
| `invoice_overdue_admin` | Factura | Admin | Automático programado | Vencimiento impago | `admin_pago_pendiente` | cliente, folio, monto, días vencido | Media | 3 |
| `invoice_overdue_client` | Factura | Cliente | Automático programado | Vencimiento impago | futura plantilla cliente cobranza | cliente, documento, monto, vencimiento | Baja/Media | 4 |

---

## Eventos prioritarios por destinatario

### Operadores

- asignación de servicio
- modificación relevante
- cancelación
- recordatorio previo

### Clientes

- confirmación de servicio
- modificación relevante
- cancelación
- recordatorio previo

### Proveedores

- orden de compra emitida
- solicitud de confirmación
- seguimiento manual

### Admins

- servicio completado
- documento próximo a vencer
- pago pendiente
- servicio sin cotización
- orden de compra pendiente
- resumen diario o mensual

---

## Definición de cambio relevante

Debe generar notificación:

- cambio de fecha
- cambio de hora
- cambio de origen
- cambio de destino
- cambio de operador
- cancelación

No debe generar notificación:

- observaciones internas
- ajustes de costos
- cambios financieros internos
- modificaciones administrativas no visibles para el destinatario

---

## Datos mínimos requeridos

### Operadores

- nombre
- teléfono válido
- servicio asignado
- fecha del servicio

### Clientes

- nombre o contacto
- teléfono válido
- folio
- fecha y hora
- origen y destino cuando aplique

### Proveedores

- nombre del proveedor
- teléfono válido
- referencia de orden de compra
- detalle breve
- contexto o fecha asociada

---

## Modelo conceptual recomendado

### `message_recipients`

Catálogo lógico de destinatarios.

Tipos sugeridos:

- `operator`
- `client`
- `supplier`
- `admin`

Documentos relacionados:

- `PRD.md`
- `docs/guia-configuracion-whatsapp.md`

Campos sugeridos:

- `id`
- `recipient_type`
- `entity_id`
- `display_name`
- `phone`
- `phone_whatsapp`
- `is_active`

### `message_preferences`

Preferencias por evento y canal.

Campos sugeridos:

- `id`
- `recipient_id`
- `event_key`
- `channel`
- `enabled`

### `message_templates`

Mapa lógico entre evento, destinatario y plantilla real aprobada en Meta.

Campos sugeridos:

- `id`
- `event_key`
- `recipient_type`
- `channel`
- `template_name`
- `language_code`
- `is_active`

### `message_dispatch_log`

Historial unificado de mensajes enviados, omitidos y fallidos.

Campos sugeridos:

- `id`
- `event_key`
- `recipient_type`
- `recipient_id`
- `entity_type`
- `entity_id`
- `channel`
- `template_name`
- `status`
- `error_code`
- `error_message`
- `provider_message_id`
- `payload_context`
- `triggered_by`
- `created_at`

### `message_queue` (opcional)

Recomendada solo si a futuro se necesitan:

- reintentos automáticos
- programación avanzada
- desacople fuerte entre trigger y envío real

---

## Reglas de negocio a definir

- qué eventos serán automáticos y cuáles manuales
- qué cambios de servicio califican como "modificación relevante"
- si existirá canal preferido por destinatario o solo WhatsApp
- si clientes y proveedores podrán optar por no recibir ciertos mensajes
- qué datos mínimos serán obligatorios antes de habilitar mensajería externa
- si los mensajes a proveedores partirán manuales o semi-automáticos

---

## Decisiones recomendadas

### Clientes fase 1

Incluir solo:

- confirmación de servicio
- modificación relevante
- cancelación
- recordatorio previo

No incluir en la primera ola:

- cobranza
- mensajes promocionales
- comunicaciones no operativas

### Proveedores fase 1

Incluir solo:

- orden de compra emitida
- solicitud de confirmación
- seguimiento manual

### Automatización

- automático para operadores y clientes en eventos del servicio
- mixto para proveedores: partir manual y automatizar después

### Canales

- comenzar con WhatsApp como canal principal
- dejar diseño abierto para email después, sin incluirlo aún en el alcance inicial

---

## Riesgos principales

- crecimiento desordenado de plantillas
- mezcla entre mensajes operativos y comerciales
- falta de validación homogénea de teléfonos
- ausencia de criterios claros para eventos relevantes
- trazabilidad insuficiente frente a errores o reclamos

---

## Backlog de planificación

- definir lista oficial de eventos de negocio
- definir destinatarios por evento
- definir plantillas necesarias por fase
- definir reglas de activación manual y automática
- definir política de teléfonos y validación
- definir qué se mostrará en historial o log dentro de la app
- definir criterios de éxito por fase

---

## Recomendación final

- cerrar primero Meta productivo y validar `operadores + admins`
- extender luego a `clientes` con un set reducido de eventos de alto valor
- incorporar `proveedores` en una fase posterior, inicialmente con mensajes manuales o controlados
- diseñar desde ya la expansión como una capa de mensajería unificada, aunque la implementación se haga por etapas

Resultado esperado:

- un sistema de mensajería operacional, trazable y escalable
- baja complejidad en la etapa inicial
- base sólida para crecer sin rehacer arquitectura ni duplicar lógica
