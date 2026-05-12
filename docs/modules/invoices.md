# invoices

## Resumen
Modulo de **facturas** y **pagos** para creacion, edicion, conciliacion, alertas, anulaciones, exportacion y consulta portal.

La implementacion actual va bastante mas alla de un CRUD simple: crea facturas desde cierres, sincroniza relaciones, soporta conciliacion y contiene tooling administrativo para anulacion, eliminacion protegida, exportacion y backfill historico.

## Entrypoints vigentes
- Pagina backoffice: [Invoices](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Invoices.tsx)
- Pagina portal: [PortalInvoices](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/portal/PortalInvoices.tsx)
- Componentes: [src/components/invoices](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/invoices)

## Rutas
- `/invoices`
- `/portal/invoices`

Nota:
- `InvoiceAlertSettings` pertenece hoy a `Settings`, no a la pagina principal de `/invoices`.

## Arquitectura actual de la pagina backoffice
La pagina principal monta y coordina:

- `InvoicesHeader`
- `InvoicesStats`
- `InvoicesSearch`
- `InvoicesTable`
- `InvoicesPipelineView`
- `InvoicesMobileView`
- `InvoiceForm`
- `PaymentReconciliation`
- `InvoiceAlertsDashboard`
- `InvoiceCancellationsHistory`
- `MarkAsPaidModal`
- `InvoiceDetailsModal`
- `InvoiceBatchActions`
- `InvoiceExportModal`

Componentes existentes pero no necesariamente centrales en la UI actual:

- `PaymentApplicationModal`
- `SelectivePaymentModal`
- `SystemHealthIndicator`
- piezas auxiliares de exportacion, historial o tooling administrativo

## Hooks y servicios clave
- `useInvoices`
- `usePagedInvoices`
- `useInvoiceData`
- `useInvoiceOperations`
- `useInvoiceCancellation`
- `useInvoiceAlerts`

Notas relevantes:
- `useInvoices` compone datos y operaciones del modulo.
- `usePendingPayments` no es un hook central de invoices; pertenece al flujo de pagos de proveedores.

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `invoices`
- `invoice_services`
- `invoice_closures`
- `payments`
- `payment_applications`
- `invoice_cancellations`
- `service_closures`
- relaciones con `services` y `clients`

RPC y operaciones destacadas:

- `create_invoice_transaction`
- `force_update_service_to_invoiced`
- `create_automatic_payment_for_invoice`
- RPC y tooling de conciliacion o correccion segun contexto administrativo

## Flujos vigentes

### 1. Creacion de factura desde cierre
- El flujo real parte desde `closureId`.
- `productServiceDescription` es parte requerida del formulario actual.
- La creacion usa una operacion transaccional y sincroniza relaciones con cierre y servicios.
- La pagina puede abrir el formulario automaticamente cuando llega desde `Closures` con un cierre preseleccionado.

### 2. Listado, pipeline y portal
- Backoffice combina tabla, pipeline y vista mobile.
- Portal cliente expone consulta de facturas propias en `/portal/invoices`.

### 3. Pago y conciliacion
- La conciliacion visible actual prioriza registro de pago, historial, detalle y backfill historico.
- `SmartPaymentForm` participa en el flujo visible actual.
- Existen piezas para aplicacion manual o selectiva, pero no deben documentarse como la unica UX activa sin aclaracion.

### 4. Factura creada como pagada
- Si se crea con estado `paid`, la pagina puede disparar `markAsPaid` y generar pago automatico.

### 5. Anulacion y cancelaciones
- La anulacion no solo registra una NC o historial.
- Tambien puede revertir relaciones con cierres y servicios y dejar trazabilidad en `invoice_cancellations`.

### 6. Eliminacion protegida y acciones administrativas
- Existe eliminacion reforzada por contrasena.
- Hay diferencias de tratamiento para facturas historicas y flujos protegidos.
- El modulo incluye exportacion y acciones por lote.

## Consideraciones de mantenimiento
- Si se cambia el formulario, mantener alineado el flujo real de `closureId`, descripcion requerida y transaccion de creacion.
- Si se cambia conciliacion, revisar tanto UI visible como tooling administrativo y portal.
- Documentar por separado lo que vive en `/invoices`, lo que vive en `/portal/invoices` y lo que fue movido a `Settings`.
