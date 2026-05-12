# costs

## Resumen
Modulo de **costos** para registro, edicion, duplicacion, trazabilidad y cargas masivas (`CSV`/`XML`).

La pagina actual ya no es solo un listado con formulario basico: combina costo rapido, costo completo, detalle consolidado, acciones batch y sincronizacion directa con inventario mediante `UnifiedPurchaseService`.

## Entrypoints vigentes
- Pagina: [Costs](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Costs.tsx)
- Componentes: [src/components/costs](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/costs)
- Servicio de compra unificada: [UnifiedPurchaseService](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/services/UnifiedPurchaseService.ts)

## Ruta
- `/costs`

## Arquitectura actual de la pagina
La pagina real de costos se apoya en estas piezas principales:

- `CostsDashboard`
- `UnifiedCostFilters`
- `EnhancedCostsTable` y `CostList`
- `QuickCostForm`
- `CostForm`
- `ConsolidatedCostDetails`
- `CSVCostUpload`
- `XMLCostUpload`
- `CostBatchUpdateModal`
- `DistributionAssistantDialog`
- `CostDeleteConfirmDialog`

Notas relevantes:
- `ConsolidatedCostDetails` es hoy el detalle principal del modulo.
- La pagina soporta apertura contextual por query string, prefill por navegacion y duplicacion de costos.

## Hooks y servicios clave
- `useCosts`
- `useDeleteCost`
- `useCostCategories`
- `useCostSubcategories`
- `useUpdateCostsBatch`
- `useCostCSVUpload`
- `useUniversalSync`
- `useInventorySyncWatcher`
- `UnifiedPurchaseService`

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `costs`
- `cost_categories`, `cost_subcategories`, `cost_centers`
- `inventory_movements`, `inventory_items`, `inventory_stock`
- `supplier_payments`, `inventory_suppliers`
- relaciones con `services` y `cranes`

RPC y funciones de apoyo relevantes:

- `find_matching_costs_for_invoice`
- tooling de limpieza o diagnostico segun contexto administrativo

## Flujos vigentes

### 1. Costo rapido
- Alta rapida desde `QuickCostForm`.
- Orientado a captura agil con menos campos.
- Convive con el formulario completo; no es un flujo secundario.

### 2. Costo completo
- Alta o edicion desde `CostForm`.
- Puede recibir prefill por navegacion, quick entry o duplicacion.
- Integra clasificacion, proveedor, servicio, grua, inventario y consumo inmediato.

### 3. Integracion con inventario
- El formulario completo puede registrar una compra inventariable.
- La sincronizacion usa `UnifiedPurchaseService`.
- Puede crear movimiento de entrada, enlazar costo existente y consumir inmediatamente a grua si corresponde.

### 4. Importacion masiva
- `CSVCostUpload` para cargas estructuradas.
- `XMLCostUpload` para documentos tributarios con deteccion de duplicados, sugerencias y enlaces.

### 5. Operacion batch y detalle
- seleccion multiple de costos
- actualizacion batch
- marcado batch de pagado
- apertura de detalle consolidado
- confirmacion reforzada para borrado
- distribucion de costo a multiples gruas mediante `DistributionAssistantDialog`

### 6. Aperturas contextuales
- apertura por `?costId=...`
- prefill por navegacion desde otros modulos
- duplicacion con datos preparados para un nuevo registro

## Consideraciones de mantenimiento
- Si un cambio toca costos inventariables, revisar siempre el impacto en `UnifiedPurchaseService`.
- Si un cambio toca XML, validar duplicados, sugerencias y enlaces con proveedores e inventario.
- Los cambios en detalle, batch actions o filtros deben verificarse tanto en tabla como en cards/mobile.
