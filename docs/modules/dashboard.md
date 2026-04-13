# dashboard

## Resumen
Módulo de tablero administrativo que centraliza **KPIs**, alertas operativas y accesos rápidos a entidades clave (servicios recientes, pendientes, categorías con incidencias).

**Entrypoints**
- Página: [Dashboard](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Dashboard.tsx)
- Componentes: [src/components/dashboard](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/dashboard)

## Arquitectura y componentes
- Presentación basada en tarjetas y tablas (componentes UI compartidos).
- Datos agregados típicamente provienen de hooks con React Query (ej. `useDashboardData`, `usePendingSummary`, `useServiceRequestAlerts`), que consultan Supabase y/o RPC para estadísticas.
- Se integra con notificaciones/toasts para destacar anomalías o pendientes críticos.

## API expuesta

### Ruta (frontend)
- `/dashboard`

### Componentes públicos (uso típico)
- `AlertsPanel`, `RecentServicesTable`, `MetricCard`, `PendingSummaryModal`, `ServiceHealthDashboard` (bajo `@/components/dashboard/*`).

### Datos (Supabase)
Este módulo consume datos de múltiples dominios; según el esquema, lo habitual incluye:
- `services`, `invoices`, `payments`, `costs`, `calendar_events`, `notification_settings/logs`.
- RPC para alertas de vencimientos (p. ej. `get_overdue_invoices_for_alerts`).

## Especificación de uso (con ejemplos)

### Render básico de un KPI
```tsx
import { MetricCard } from '@/components/dashboard/MetricCard'

<MetricCard title="Servicios" value={123} subtitle="Últimos 30 días" />
```

## Dependencias

### Externas (principales)
- `react`, `react-router-dom`
- `date-fns`
- `lucide-react`
- `sonner`

### Internas (principales)
- `@/components/ui/*` (cards, tables, dialogs)
- `@/hooks/*` (datos agregados)
- `@/integrations/supabase/client`

## Configuración requerida
- Acceso por rol: el dashboard está bajo `ProtectedRoute` para `admin/viewer`.
- Políticas RLS: deben permitir leer los datos agregados requeridos para el rol.

## Casos de uso principales
- Visualizar estado operacional y financiero (pendientes, vencidos, actividad reciente).
- Identificar “hotspots” (categorías con incidencias, inconsistencias, alertas del sistema).

## Diagramas

```mermaid
flowchart LR
  D[Dashboard] --> H[Hooks (react-query)]
  H --> S[Supabase]
  D --> UI[Componentes UI]
  S --> T[(Tablas/RPC)]
```

## Rendimiento
- Evitar consultas redundantes: centralizar agregaciones en hooks y cachear con React Query.
- En tablas grandes (servicios/facturas), usar paginación/filtrado server-side.

## Seguridad
- No exponer métricas sensibles a roles no autorizados (enforcement en RLS).
- Cuidar que agregaciones no permitan inferir datos restringidos (ej. conteos por cliente si hay RLS por cliente).
