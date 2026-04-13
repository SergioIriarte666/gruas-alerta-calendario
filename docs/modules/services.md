# services

## Resumen
Módulo central de operación para administrar **servicios** (creación, edición, seguimiento de estado, asignación de recursos, evidencias, costos asociados y relación con cierres/facturación).

**Entrypoints**
- Página: [Services](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Services.tsx)
- Componentes: [src/components/services](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/services)
- Hooks relacionados (no exhaustivo): `useServices`, `useServiceDetails`, `useServiceCosts`, `useServiceChangeHistory`, `useServiceLiberation`, `useUpdateServicesBatch`.

## Arquitectura y componentes

### Capas internas
- **UI**: tablas/listas, filtros avanzados, formularios paso a paso (`components/services/form/*`), modales de detalle/edición.
- **Datos**: hooks con React Query que consultan Supabase (tablas y RPC) y normalizan errores.
- **Consistencia**: acciones administrativas (cierres de emergencia, sincronización de comisiones) a través de RPC.

### Componentes principales (referencia)
- Listado/operación:
  - `ServicesTable`, `ServicesPipelineView`, `ServicesMobileView`, `ServicesMetrics`, `ServicesHeader`.
- Detalle y auditoría:
  - `ServiceDetailsModal`, `ServiceChangeHistory`, `VehicleHistory`.
- Formularios:
  - `EnhancedServiceForm` + subcomponentes en `components/services/form/*`.
- Carga masiva:
  - `CSVUploadServices`, `EnhancedCSVUploadServices`.

## API expuesta

### Ruta (frontend)
- `/services`

### Superficie pública (componentes)
Ejemplos de imports:
```tsx
import { ServicesHeader } from '@/components/services/ServicesHeader'
import { EnhancedServiceForm } from '@/components/services/EnhancedServiceForm'
import { ServicesTable } from '@/components/services/ServicesTable'
```

### Operaciones Supabase (tablas/RPC)
Tablas típicamente involucradas:
- `services` (entidad principal)
- `service_costs`, `costs` (costos asociados)
- `service_change_history` (auditoría)
- `inspections` (inspección pre-servicio / post, según flujo)
- `calendar_events` (eventos calendarizados del servicio)
- `closure_services` y `invoice_services` (integración con cierres/facturas)

RPC detectadas en el módulo:
- `emergency_close_service`
- `force_commission_sync_for_service`

Referencia del catálogo de tablas/RPC: [types.ts](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/integrations/supabase/types.ts).

## Especificación de uso (con ejemplos)

### Renderizar listado + abrir detalle
```tsx
import { ServicesTable } from '@/components/services/ServicesTable'
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal'

// El patrón típico es mantener un estado local selectedServiceId y
// delegar a hooks para cargar datos (react-query).
```

### Cerrar un servicio por emergencia (RPC)
```ts
import { supabase } from '@/integrations/supabase/client'

const { data, error } = await supabase.rpc('emergency_close_service', { p_service_id: serviceId })
if (error) throw error
```

## Dependencias

### Externas (principales)
- `react`
- `@tanstack/react-query`
- `date-fns`
- `lodash` (debounce en formularios)
- `lucide-react`
- `sonner`

### Internas (principales)
- `@/integrations/supabase/client`
- `@/hooks/*` (servicios/costos/inspecciones/historial)
- `@/components/ui/*` (table, dialog, form, tabs, etc.)
- `@/utils/*` (validaciones, helpers de estado, generación de folio/reportes)

## Configuración requerida
- Permisos:
  - Acceso restringido por rol (admin/viewer) y opcionalmente por permisos de módulo (`user_module_permissions`).
- Consistencia BD:
  - Triggers/RPC relacionados a cambios de estado y facturación deben estar desplegados en Supabase.

## Casos de uso principales
- Registrar y dar seguimiento a un servicio operativo.
- Asignar grúa/operador/recursos y gestionar cambios.
- Adjuntar costos/consumos y evidencias.
- Convertir/relacionar con cierres y facturación.

## Diagramas

```mermaid
flowchart TD
  UI[Services UI] --> H[Hooks (react-query)]
  H --> SB[Supabase]
  SB --> SVC[(services)]
  SB --> COST[(service_costs/costs)]
  SB --> INS[(inspections)]
  SB --> CAL[(calendar_events)]
  SB --> RPC[RPC: emergency_close_service]
  UI --> INV[invoices/closures modules]
```

## Rendimiento
- Listados grandes: usar paginación/filtrado server-side; evitar `select('*')`.
- Acciones masivas: preferir endpoints batch/RPC o actualizaciones por lotes controladas para evitar rate limits.
- Cache: invalidar queries por clave (services, serviceDetails, metrics) tras mutaciones.

## Seguridad
- RLS: restringir `services` y tablas relacionadas por rol y/o por relación cliente/operador.
- Auditoría: `service_change_history` debe registrar “qué cambió” sin incluir datos sensibles innecesarios.
- Acciones críticas (cierres de emergencia, sincronización) deben validarse en RPC con `auth.uid()`/rol.
