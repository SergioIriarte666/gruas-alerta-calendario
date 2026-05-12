# cranes

## Resumen
Modulo de **gruas** para administracion de flota, metricas, mantenimiento, documentos, costos, servicios, piezas e integracion con inventario.

La UI actual del detalle ya no gira en torno a tabs de informacion o documentos separados; hoy se centra en una vista con `CraneTabsWithCounters`, overview operativo y una tab fuerte de inventario y sincronizacion.

## Entrypoints vigentes
- Pagina: [Cranes](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Cranes.tsx)
- Componentes: [src/components/cranes](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/cranes)

## Ruta
- `/cranes`

## Arquitectura actual de la pagina
La pagina principal se apoya en:

- `CranesHeader`
- `CranesTable` y vistas mobile
- `CraneDetailsModal`
- `MaintenanceForm`
- intake desde Quick Entry con `prefilledData`

El detalle vigente monta tabs mediante `CraneTabsWithCounters`:

- `CraneMetricsOverview`
- `CraneServices`
- `CraneCosts`
- `CraneParts`
- `CraneMaintenanceTab`
- `CraneInventoryTab`

Notas relevantes:
- `CraneDocumentsSection` vive dentro del overview actual, no como tab independiente.
- Existen componentes de migracion, trazabilidad o documentacion legacy, pero no todos forman parte de la UX principal.

## Hooks y servicios clave
- `useCranes`
- `useCraneMetrics`
- `useCraneCosts`
- `useCraneMaintenance`
- `useCraneDocuments`
- `useCraneServices`
- `useCraneInventoryMetrics`
- `useUnifiedParts`
- `usePartsTraceability`
- `useInventorySyncStats`
- `useMigrateUnsyncParts`

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `cranes`
- `crane_maintenance`
- `crane_documents`
- `costs`
- `services`
- `inventory_movements`
- `crane_parts`
- `document_alerts`

RPC o funciones de apoyo relevantes:

- `get_crane_metrics`
- `get_parts_traceability`
- `force_resync_crane_part`
- tooling de deduplicacion o migracion segun contexto

## Flujos vigentes

### 1. Ficha y overview operativo
- `CraneMetricsOverview` concentra metricas, resumen y documentacion.
- `CraneDocumentsSection` forma parte del overview actual.

### 2. Mantenimiento
- El modulo soporta alta y seguimiento de mantenciones.
- Puede abrirse desde flujo normal o desde Quick Entry con prefill.

### 3. Piezas y consumos
- La tab `CraneParts` hoy se apoya fuertemente en consumos e integracion con inventario.
- No debe documentarse solo como CRUD aislado de `crane_parts`.

### 4. Inventario y sincronizacion
- `CraneInventoryTab` es una pieza central del modulo actual.
- Integra metricas, trazabilidad de partes, sincronizacion y herramientas operativas complementarias.

### 5. Flujo desde Quick Entry
- La pagina puede abrir intake con datos prellenados para crear mantenimiento desde registro rapido.

## Consideraciones de mantenimiento
- Priorizar `CraneTabsWithCounters` y `CraneInventoryTab` como referencia de la UI actual.
- Si un cambio toca piezas o consumos, revisar siempre impacto en inventario y sincronizacion.
- Distinguir en la doc entre tabs realmente visibles y componentes legacy o de tooling admin.
