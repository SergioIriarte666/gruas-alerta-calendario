# daily-report

## Resumen
Modulo de **daily report** para consolidado diario operativo y financiero, con exportacion y modales de detalle.

La pagina actual trabaja con multiples queries cliente-side y tiempo real; no depende de una RPC unica de consolidacion.

## Entrypoints vigentes
- Pagina: [DailyReport](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/DailyReport.tsx)
- Componentes: [src/components/daily-report](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/daily-report)
- Hook principal: `useDailyReport`

## Ruta
- `/daily-report`

## Arquitectura actual
La pagina principal incluye 5 secciones:
- `ServicesSection`
- `SuppliersSection`
- `CalendarSection`
- `FinancialSection`
- `OperationsSection`

Ademas integra:
- exportacion PDF y Excel
- modales de detalle para servicio, evento, factura, pago, grua y operador

## Hooks y servicios clave
- `useDailyReport`

## Datos y dependencias principales
El hook consulta y consolida datos desde:
- `services`
- `invoices`
- `supplier_payments`
- `scheduled_payments`
- `cranes`
- `operators`
- `document_alerts` y datos relacionados segun seccion

## Flujos vigentes
### 1. Consolidado diario
- La consolidacion se hace cliente-side con multiples queries paralelas y `react-query`.
- El modulo usa realtime para refresco de informacion relevante.

### 2. Secciones del reporte
- Servicios completados y pendientes operativos.
- Facturas vencidas o por vencer.
- Pagos programados y pagos a proveedores.
- Alertas documentales de gruas.
- Disponibilidad de operadores y otras señales operativas.

### 3. Exportacion y detalle
- El usuario puede exportar el reporte.
- Tambien puede abrir modales de detalle desde distintas secciones.

## Consideraciones de mantenimiento
- No describir el modulo como si dependiera de una RPC unica o agregacion server-side que hoy no existe.
- Recordar que la ruta actual esta disponible para `admin` y `viewer`.
