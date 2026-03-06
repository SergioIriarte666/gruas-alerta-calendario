

## Plan: Agregar subcategorías a Proveedores y Pagos de Proveedores

### Estado actual

- **Categorías**: Ambas tablas (`suppliers` y `supplier_payments`) tienen campo `category` que referencia `cost_categories.id`. Funciona correctamente.
- **Subcategorías**: **No existe** campo `subcategory` en ninguna de las dos tablas. El módulo de Costos sí usa subcategorías dinámicas desde `cost_subcategories`, cargadas con `useCostSubcategories(categoryId)`.
- El único uso de subcategoría en proveedores es un valor hardcodeado `'Piezas y Repuestos'` que se pasa a la tabla `costs` cuando se sincroniza un pago.

### Cambios necesarios

#### 1. Migración SQL - Agregar columna `subcategory` a ambas tablas

```sql
ALTER TABLE suppliers ADD COLUMN subcategory text;
ALTER TABLE supplier_payments ADD COLUMN subcategory text;
```

#### 2. Formulario de Proveedor (`SupplierFormStep3.tsx`)

Agregar selector de subcategoría debajo del selector de categoría, usando `useCostSubcategories(selectedCategoryId)` — mismo patrón que `CostFormStep2.tsx`. Solo se muestra cuando la categoría seleccionada tiene subcategorías disponibles.

#### 3. Formulario de Pagos (`PaymentForm.tsx`)

Agregar selector de subcategoría debajo del campo de categoría existente (línea 327), usando el mismo hook `useCostSubcategories`. Actualizar el schema Zod para incluir `subcategory` opcional.

#### 4. Actualizar tipos (`src/types/suppliers.ts`)

Agregar `subcategory?: string` a `SupplierFormData` y `PaymentFormData`.

#### 5. Sincronización con Costos (`useSupplierPayments.ts`)

Reemplazar el hardcodeado `subcategory: 'Piezas y Repuestos'` por el valor real de `subcategory` del pago, para que la subcategoría se propague correctamente al módulo de costos.

#### 6. Visualización en listas

Actualizar `PaymentList.tsx` y la lista de proveedores para mostrar la subcategoría junto a la categoría cuando exista (formato: "Categoría - Subcategoría").

### Archivos a modificar
- Migración SQL (nueva)
- `src/components/suppliers/form/SupplierFormStep3.tsx`
- `src/components/suppliers/PaymentForm.tsx`
- `src/components/suppliers/SupplierForm.tsx` (schema + defaultValues)
- `src/types/suppliers.ts`
- `src/hooks/useSupplierPayments.ts`
- `src/components/suppliers/PaymentList.tsx`

