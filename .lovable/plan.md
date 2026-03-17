

## Plan: Unificación y Sincronización de Módulos Financieros

### Diagnóstico

Tras auditar el código, se identificaron estos problemas raíz:

1. **Dos tablas de proveedores** coexisten sin sincronización: `suppliers` (UI principal) e `inventory_suppliers` (FK de facturas/bodega). Esto causa que los XML importados en un módulo no aparezcan en el otro.

2. **Múltiples puntos de entrada para compras** (5 flujos distintos), cada uno con su propia lógica de creación de costos, inventario y piezas:
   - `UnifiedPurchaseService` (desde CostForm)
   - `useUnifiedParts` (desde CraneParts)
   - `useSupplierPayments.createPartCostAndInventory` (desde Proveedores)
   - `inventoryConsumptionHelper` (consumo directo)
   - `useCosts.addCost` (creación directa de costos con piezas)

3. **Invalidación de queries fragmentada**: `useCostInvalidation`, `useUniversalSync`, y cada hook individual invalidan queries distintas, causando que la UI no refleje cambios cross-módulo.

4. **XML de Proveedores** usa `parseXMLCompleteFile` que extrae proveedores + documentos, pero los proveedores se crean en `suppliers` mientras las facturas requieren `inventory_suppliers`, rompiendo la cadena.

---

### Fase 1: Unificar tabla de proveedores (base de datos)

**Objetivo**: `inventory_suppliers` es la fuente única de verdad. `suppliers` se convierte en una vista o se migra.

1. **Migración SQL**: Crear una función que migre todos los registros de `suppliers` que no existan en `inventory_suppliers` (por RUT normalizado).
2. **Crear vista `suppliers_unified`**: Vista que expone `inventory_suppliers` con los campos que la UI espera (alias de columnas como `contact_name` → `contact_person`).
3. **Actualizar FKs**: `costs.supplier_id`, `supplier_payments.supplier_id`, `crane_parts.supplier_id` apuntar a `inventory_suppliers`.
4. **Actualizar RLS**: Copiar políticas de `suppliers` a `inventory_suppliers`.

### Fase 2: Consolidar punto de entrada de compras

**Objetivo**: Un solo servicio (`UnifiedPurchaseService`) maneja TODOS los flujos.

1. **Extender `UnifiedPurchaseService`** para cubrir los 4 escenarios restantes:
   - Compra con pago a proveedor
   - Compra desde XML
   - Compra desde módulo de piezas
   - Consumo de inventario existente

2. **Refactorizar hooks**:
   - `useUnifiedParts.useUnifiedPartsPurchase` → delegar a `UnifiedPurchaseService`
   - `useSupplierPayments.createPartCostAndInventory` → delegar a `UnifiedPurchaseService`
   - `useCosts.addCost` (parte de piezas) → delegar a `UnifiedPurchaseService`

3. **Centralizar invalidación**: Todos los flujos usan `useUniversalSync.invalidateAll()` exclusivamente. Eliminar `useCostInvalidation`.

### Fase 3: Corregir importadores XML

**Objetivo**: Los XML se parsean, muestran y cargan correctamente, vinculando con la tabla unificada.

1. **`XMLDocumentUpload.tsx`**: Al crear proveedores, usar `inventory_suppliers` directamente (eliminar lógica dual).
2. **`XMLCostUpload.tsx`**: Al buscar proveedor por RUT (`findSupplierByRutOrName`), buscar en `inventory_suppliers`.
3. **`XMLSupplierUpload.tsx`**: Crear en `inventory_suppliers` en lugar de `suppliers`.
4. **`PurchaseHistoryImport.tsx`**: Simplificar lógica de resolución que actualmente hace malabares entre ambas tablas.

### Fase 4: Rediseño UX - Flujo direccional claro

**Objetivo**: Cada acción muestra claramente qué módulos se afectan.

1. **Indicadores de sincronización**: Al crear un costo con proveedor, mostrar badges indicando "→ Pago creado", "→ Inventario actualizado", "→ Pieza registrada en grúa".
2. **Panel de trazabilidad en detalle**: En el modal de detalle de costo/pago/pieza, mostrar la cadena completa (Costo ↔ Pago ↔ Movimiento ↔ Pieza).
3. **Toast unificado**: Reemplazar múltiples toasts por uno consolidado que liste todas las acciones ejecutadas.

### Fase 5: Limpieza de históricos

1. **Script de reconciliación**: Crear RPC que vincule registros huérfanos entre `costs`, `supplier_payments`, `inventory_movements` y `crane_parts` por fecha/monto/descripción.
2. **Deduplicación**: Identificar y marcar duplicados creados por la doble inserción anterior.

---

### Orden de implementación

| Paso | Descripción | Archivos principales |
|------|-------------|---------------------|
| 1 | Migración DB: unificar proveedores | SQL migration |
| 2 | Actualizar `useSuppliers` para leer de `inventory_suppliers` | `useSuppliers.ts` |
| 3 | Actualizar importadores XML | `XMLDocumentUpload.tsx`, `XMLCostUpload.tsx`, `XMLSupplierUpload.tsx` |
| 4 | Consolidar `UnifiedPurchaseService` | `UnifiedPurchaseService.ts` |
| 5 | Refactorizar hooks duplicados | `useUnifiedParts.ts`, `useSupplierPayments.ts`, `useCosts.ts` |
| 6 | Eliminar `useCostInvalidation`, usar solo `useUniversalSync` | Varios hooks |
| 7 | Agregar indicadores UX de sincronización | Componentes de formularios |
| 8 | Script de reconciliación de históricos | SQL RPC |

### Riesgo y mitigación

- **Riesgo**: La migración de `suppliers` a `inventory_suppliers` puede romper queries existentes.
- **Mitigación**: Crear la vista `suppliers_unified` primero, luego migrar gradualmente los consumers.

