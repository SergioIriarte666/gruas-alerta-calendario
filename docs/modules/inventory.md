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
- El modal se organiza en tres etapas: Costo y pago, Productos y Revision. La categoria, centro de costo, bodega, estado de pago y total permanecen visibles; la escritura solo se ejecuta desde la revision final.
- El primer paso permite elegir Pagada/Pendiente, indicar fecha de pago y referencia opcional, configurar vencimiento y agregar observaciones. La referencia se conserva en notas del costo y pago; el numero de factura sigue siendo la referencia documental del pago.
- La grua general se reemplaza por una accion explicita sobre productos seleccionados. La asignacion masiva conserva cantidades parciales existentes y no modifica productos sin seleccionar, descartados o de facturas deseleccionadas. Elegir servicio no asigna consumos a sus gruas automaticamente.
- `XMLInventoryUpload` soporta validacion de lineas, matching con catalogo, alta manual de producto y enlaces con compras/costos.
- Cada linea permite mantener el producto en bodega o indicar consumo inmediato, cantidad entera y grua de destino. El saldo no consumido permanece en la bodega seleccionada.
- La subcategoria se elige exclusivamente por producto en el segundo paso, sin selector general ni herencia automatica. Cada linea puede seleccionar una subcategoria de la categoria activa o quedar expresamente sin subcategoria. Cambiar la categoria limpia las selecciones por linea para evitar referencias incompatibles.
- Las clasificaciones se guardan en `supplier_invoice_items.cost_subcategory_id` y `cost_subcategory` (nombre conservado para trazabilidad). El detalle de Costos muestra cada clasificacion y un resumen de importes netos; la factura mantiene un solo costo y un solo pago. Si las lineas tienen clasificaciones diferentes, el costo consolidado queda sin una subcategoria global que atribuya todo el importe a una sola.
- Se conserva una factura, un costo consolidado y un pago, con movimientos vinculados por linea. Cada consumo requiere una grua elegida por producto o asignada mediante la accion masiva.
- Los destinos se guardan en `supplier_invoice_items.consumption_quantity` y `consumption_crane_id`; los registros anteriores mantienen ambos campos nulos. Las compras con destinos por linea conservan sus movimientos al editar Costos.
- La importacion completa es transaccional. La regresion SQL local se ejecuta con `node scripts/tests/xml-inventory-line-consumption.mjs` y no accede a la base remota.
- La unicidad de entradas activas se verifica por costo y linea de factura para XML; los movimientos sin linea documental conservan la unicidad por costo. Esto permite varios productos en un costo consolidado sin entradas duplicadas para la misma linea.
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
