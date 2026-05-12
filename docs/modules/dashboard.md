# dashboard

## Resumen
Modulo de **dashboard** para metricas operativas de alto nivel, alertas visibles, accesos rapidos y detalle de servicios recientes.

La pagina actual se apoya principalmente en `useDashboardData`; las alertas y pendientes viven parcialmente fuera del hook principal.

## Entrypoints vigentes
- Pagina: [Dashboard](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Dashboard.tsx)
- Componentes: [src/components/dashboard](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/dashboard)

## Ruta
- `/dashboard`

## Arquitectura actual
La pagina principal monta o combina:
- metricas y cards de resumen
- `RecentServicesTable`
- `AlertsPanel`
- `PendingSummaryModal`
- `InvoiceAlertsDashboard` como componente importado desde facturas
- `ServiceDetailsModal` para detalle desde servicios recientes

## Hooks y servicios clave
- `useDashboardData`
- `usePendingSummary` en el modal de pendientes
- `useServiceRequestAlerts` a nivel layout global, no como hook central de la pagina

## Datos y dependencias principales
`useDashboardData` consulta principalmente:
- `services`
- `invoices`

Realtime relevante:
- invalidacion por cambios en `services`, `invoices`, `costs` y `clients`

## Flujos vigentes
### 1. Metricas principales
- La fuente principal del dashboard es `useDashboardData`.
- No debe documentarse como un agregador de multiples RPC financieras si eso no ocurre en el hook real.

### 2. Alertas y pendientes
- `AlertsPanel` consume alertas del sistema via contexto.
- `PendingSummaryModal` resuelve pendientes con su propio hook.

### 3. Servicios recientes
- La tabla de recientes permite abrir `ServiceDetailsModal`.

## Consideraciones de mantenimiento
- Separar en la doc metricas, alertas globales y pendientes, porque no viven en la misma capa.
- No documentar `ServiceHealthDashboard` como pieza visible si no esta montado en la pagina actual.
