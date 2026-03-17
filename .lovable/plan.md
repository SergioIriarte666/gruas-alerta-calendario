

## Plan: Unificación y Sincronización de Módulos Financieros

### Estado actual

#### ✅ Fase 1: Migración DB completada
- Columnas `category`, `subcategory`, `notes`, `updated_by` agregadas a `inventory_suppliers`
- Datos migrados de `suppliers` → `inventory_suppliers` (dedup por RUT normalizado)
- FKs de `costs`, `crane_parts`, `creditors`, `supplier_payments`, `inventory_movements` redirigidas a `inventory_suppliers`
- IDs remapeados en todas las tablas dependientes

#### ✅ Fase 2: Hooks actualizados
- `useSuppliers.ts` lee/escribe de `inventory_suppliers`
- `useSupplierStats.ts` consulta `inventory_suppliers`
- `useSupplierPayments.ts` usa `useUniversalSync` (elimina `useCostInvalidation`)
- `usePurchaseInvoices.ts` consulta `inventory_suppliers`
- `useInventory.ts` joins corregidos a `inventory_suppliers`
- `finance/useSuppliers.ts` re-exporta del hook unificado

#### ✅ Fase 3: XML importers corregidos
- `XMLCostUpload.tsx` - `findSupplierByRutOrName` busca en `inventory_suppliers`
- `XMLDocumentUpload.tsx` - usa `useSuppliers` que ya lee de `inventory_suppliers`
- `UnifiedPurchaseService.ts` - lookup de proveedor desde `inventory_suppliers`
- `BatchEditSuppliersModal.tsx` - escribe a `inventory_suppliers`

#### 🔲 Fase 4: Consolidar UnifiedPurchaseService (pendiente)
- Extender para cubrir todos los flujos de compra
- Refactorizar `useUnifiedParts`, `useSupplierPayments.createPartCostAndInventory`

#### 🔲 Fase 5: UX sincronización + limpieza (pendiente)
- Badges de sync, toasts unificados
- Script de reconciliación de históricos

### Archivos que aún pueden referenciar tabla `suppliers` directamente
- `src/components/finance/historical/PurchaseHistoryImport.tsx` (tiene lógica dual, simplificar)
- `src/utils/purchaseHistoryParser.ts`
