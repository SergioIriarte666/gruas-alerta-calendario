

## Plan: Corregir detección de duplicados en importación de compras + limpiar duplicados existentes

### Problema raíz

La detección de duplicados falla en **dos niveles**:

1. **En la preview** (al cargar archivo): La query que construye `existingKeys` (línea 327-339) hace un join con la tabla `suppliers` (`supplier:suppliers(rut)`), pero `supplier_invoices.supplier_id` **no tiene FK a `suppliers`** — apunta a `inventory_suppliers`. Resultado: el join no encuentra nada y todas las facturas aparecen como "nuevas".

2. **En el pre-filtro de inserción** (línea 792-812): Compara `supplier_id + invoice_number`, pero como la detección de preview ya falló, todas las facturas pasan como seleccionadas y se insertan de nuevo.

**137 grupos de facturas duplicadas** existen actualmente en la base de datos.

### Cambios

#### 1. Corregir query de existingKeys en `PurchaseHistoryImport.tsx`

Reemplazar el join con `suppliers` por una query directa a `supplier_invoices` + `inventory_suppliers`:

```typescript
// Obtener facturas existentes con el RUT del inventory_supplier
const { data: existingInvoices } = await supabase
  .from('supplier_invoices')
  .select('invoice_number, supplier_id');

// Obtener todos los inventory_suppliers para mapear supplier_id → RUT normalizado
const { data: allInvSups } = await (supabase as any)
  .from('inventory_suppliers')
  .select('id, rut');

const supplierIdToRut = new Map<string, string>();
allInvSups?.forEach((s: any) => {
  if (s.rut) supplierIdToRut.set(s.id, normalizeRut(s.rut));
});

const existingKeys = new Set<string>();
existingInvoices?.forEach((inv: any) => {
  const nRut = supplierIdToRut.get(inv.supplier_id);
  if (nRut && inv.invoice_number) {
    existingKeys.add(`${nRut}-${inv.invoice_number}`);
  }
});
```

Esto hará que el parser detecte correctamente las facturas ya importadas y las clasifique como "duplicados" en la preview.

#### 2. Mejorar pre-filtro de inserción

Usar la misma lógica de RUT normalizado en el pre-filtro (línea 792), comparando por `invoice_number` + RUT normalizado en vez de `supplier_id` directo (que puede variar entre imports).

#### 3. Limpiar duplicados existentes (migración SQL)

Eliminar los 137 grupos de duplicados, conservando solo el registro más antiguo:

```sql
DELETE FROM supplier_invoices 
WHERE id NOT IN (
  SELECT DISTINCT ON (supplier_id, invoice_number) id 
  FROM supplier_invoices 
  ORDER BY supplier_id, invoice_number, created_at ASC
);
```

#### 4. Crear índice único para prevención permanente

```sql
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_supplier_invoice_unique 
ON supplier_invoices (supplier_id, invoice_number);
```

Esto garantiza que nunca más se puedan crear duplicados a nivel de base de datos.

### Archivos a modificar
- `src/components/finance/historical/PurchaseHistoryImport.tsx` — corregir query existingKeys + pre-filtro
- Migración SQL — limpiar duplicados + crear índice único

