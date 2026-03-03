

# Plan: Unificar Categorías — Una Sola Fuente de Verdad (`cost_categories`)

## Problema

Existen **dos tablas de categorías separadas** que gestionan conceptos superpuestos:

| Tabla | Registros | Usado por |
|---|---|---|
| `cost_categories` | 17 | Costos (`costs.category_id` → UUID FK) |
| `supplier_categories` | 22 | Proveedores (`suppliers.category` → TEXT libre), Pagos (`supplier_payments.category` → TEXT libre) |

Ambas tienen nombres duplicados (Administrativos, Mantenimiento, Peajes, Inventario, etc.). Además, `suppliers.category` y `supplier_payments.category` son campos TEXT que almacenan una mezcla de UUIDs de ambas tablas y strings legacy ("administrativos", "otros"). El resolver `resolveSupplierPaymentCategoryLabel` intenta resolver de ambas fuentes, evidenciando la falta de fuente de verdad.

En Configuración solo se gestionan `cost_categories` (pestaña Costos). En Proveedores hay otra pestaña "Categorías" que gestiona `supplier_categories` por separado.

## Solución

**`cost_categories` será la única fuente de verdad** para categorías financieras en todo el sistema (costos, proveedores, pagos, inventario).

### 1. Migración de Datos SQL

- **Mapear** cada `supplier_categories` a su equivalente en `cost_categories` (por nombre). Crear en `cost_categories` las que no existan (ej: Créditos, TAG, Parcela, Insumos Lavado, Telefonia e Internet).
- **Actualizar `supplier_payments.category`**: reemplazar UUIDs de `supplier_categories` y strings legacy por el UUID correspondiente de `cost_categories`.
- **Actualizar `suppliers.category`**: mismo tratamiento.
- **No eliminar `supplier_categories`** aún (mantener como respaldo temporal), pero marcar como deprecated.

### 2. Frontend — Eliminar `useSupplierCategoryManager` 

Reemplazar todas las referencias a `useSupplierCategoryManager` y `supplier_categories` por `useCostCategories`:

- **`PaymentList.tsx`**: Usar solo `costCategories` en vez de combinar ambas listas.
- **`PaymentForm.tsx`**: Selector de categoría desde `cost_categories`.
- **`SupplierForm.tsx`**: Selector de categoría desde `cost_categories`.
- **`SupplierList.tsx`**: Resolver categoría desde `cost_categories`.
- **`SupplierGeneralTab.tsx`**: Resolver desde `cost_categories`.
- **`EnhancedCostsTable.tsx`**: Eliminar import de `useSupplierCategoryManager`.
- **`XMLSupplierUpload.tsx`**: Usar `cost_categories` para mapeo.

### 3. Eliminar `resolveSupplierPaymentCategoryLabel`

Ya no será necesario resolver de múltiples fuentes. Una simple búsqueda por UUID en `cost_categories` + fallback es suficiente.

### 4. Configuración — Eliminar pestaña "Categorías" de Proveedores

La pestaña "Categorías" en `/suppliers` (`SupplierCategoryList`) se elimina. Las categorías se gestionan solo desde Configuración → Categorías de Costos, que aplican globalmente a costos y proveedores.

### 5. Archivos afectados

| Archivo | Acción |
|---|---|
| `src/hooks/useSupplierCategoryManager.ts` | Eliminar |
| `src/utils/suppliers/resolveSupplierPaymentCategory.ts` | Simplificar (solo buscar en cost_categories) |
| `src/utils/categoryUtils.ts` | Actualizar para usar cost_categories |
| `src/components/suppliers/categories/*` | Eliminar directorio |
| `src/components/suppliers/PaymentList.tsx` | Refactorizar imports |
| `src/components/suppliers/PaymentForm.tsx` | Refactorizar selector |
| `src/components/suppliers/SupplierForm.tsx` | Refactorizar selector |
| `src/components/suppliers/SupplierList.tsx` | Refactorizar resolución |
| `src/components/suppliers/detail/SupplierGeneralTab.tsx` | Refactorizar |
| `src/components/costs/EnhancedCostsTable.tsx` | Limpiar import |
| `src/pages/Suppliers.tsx` | Eliminar tab "Categorías" |
| `src/types/suppliers.ts` | Eliminar `SupplierCategory` type |
| Migración SQL | Mapear datos + crear categorías faltantes |

### Resultado

- **Una sola tabla**: `cost_categories` gestiona categorías para costos, proveedores y pagos.
- **Un solo lugar de administración**: Configuración → Categorías.
- **Consistencia total**: Un pago a proveedor y su costo asociado siempre comparten la misma categoría.
- **Sin resolver complejo**: Búsqueda directa por UUID.

