# inventory

## Resumen
Modulo de **inventario** para control de stock, movimientos, reportes y sincronizacion con compras, costos, proveedores y gruas.

La ruta actual de inventario esta centrada en tres superficies visibles: stock, historial de movimientos y reportes. Existen componentes auxiliares de limpieza, sync y diagnostico, pero no todos estan montados en la pagina principal.

## Entrypoints vigentes
- Pagina: [Inventory](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Inventory.tsx)
- Componentes: [src/components/inventory](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/inventory)
- Servicio de compra unificada: [UnifiedPurchaseService](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/services/UnifiedPurchaseService.ts)

## Ruta
- `/inventory`

## Arquitectura actual de la pagina
La ruta `/inventory` monta principalmente:

- `InventoryStockView`
- `MovementsHistoryTable`
- `InventoryReportsPage`
- `InventoryMovementForm` en modal para prefill desde Quick Entry
- `XMLInventoryUpload`

Dentro de `InventoryStockView` viven ademas flujos operativos importantes:

- `SimpleEntryForm`
- `SimpleExitForm`
- `ProductDrawer`
- `DuplicateProductsPanel` como modal
- acciones de quick movement, merge y limpieza de huerfanos

Componentes existentes pero no centrales en la ruta principal actual:

- `InventoryAlertsPage`
- `InventorySyncDashboard`
- paneles de diagnostico o fix administrativos

## Hooks y servicios clave
Exports granulares vigentes:

- `useInventoryItems`
- `useInventoryStock`
- `useInventoryMovements`
- `useInventoryStats`
- `useCreateInventoryMovement`
- `useCreateInventoryItem`
- `useUpdateInventoryMovement`
- `useMergeInventoryItems`
- `useStockReport`
- `useMovementReport`
- `useCostAnalysisReport`
- `usePredictiveAnalysis`
- `useInventorySyncWatcher`
- `useInventoryDeduction`
- `useUnifiedPurchase`

## Datos y dependencias principales
Tablas frecuentes:

- `inventory_items`
- `inventory_stock`
- `inventory_movements`
- `inventory_locations`
- `inventory_categories`
- `inventory_alerts`
- `inventory_consumptions`
- relaciones con `costs`, `supplier_invoices`, `supplier_invoice_items`, `supplier_payments`, `crane_parts`

RPC y tooling frecuentes:

- `merge_inventory_items`
- limpiezas y migraciones administrativas segun contexto

## Flujos vigentes

### 1. Stock y catalogo operativo
- La vista principal de stock vive en `InventoryStockView`.
- Combina tabla/tarjetas, drawer de producto y acciones rapidas.
- No depende de un `ProductCatalogTable` como superficie principal actual.

### 2. Entradas de inventario
- `SimpleEntryForm` es el flujo operativo principal para compras/entradas.
- Usa `useUnifiedPurchase` para crear compra unificada con costo y movimiento.
- Puede contemplar consumo inmediato a grua cuando aplica.

### 3. Salidas y consumo
- `SimpleExitForm` valida stock disponible.
- Mantiene trazabilidad desde la entrada origen cuando es posible.
- Puede arrastrar datos como documento de referencia, lote y costo real.

### 4. Historial y reportes
- `MovementsHistoryTable` concentra revision y edicion de movimientos.
- `InventoryReportsPage` cubre reporteria y vistas analiticas.

### 5. Prefill desde Quick Entry
- La pagina puede abrir `InventoryMovementForm` con datos prellenados.
- Puede adjuntar fotos del quick entry y limpiar el registro rapido al finalizar.

### 6. Importacion XML
- `XMLInventoryUpload` soporta validacion de lineas, matching con catalogo, alta manual de producto y enlaces con compras/costos.
- No es solo una importacion pasiva de facturas proveedor.

### 7. Herramientas de saneamiento
- merge de duplicados
- limpieza de huerfanos
- quick movement
- flujos administrativos de reparacion no siempre montados en tabs principales

## Consideraciones de mantenimiento
- Documentar por separado lo que esta montado en `/inventory` versus tooling auxiliar existente.
- Si un cambio toca entradas/salidas, validar impacto en costo, proveedor y grua.
- Si un cambio toca XML, revisar matching manual, alta de producto y sincronizacion con compras.
