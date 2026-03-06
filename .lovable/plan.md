

## Plan: Corregir errores de importación en Historial de Compras

### Problema identificado

Hay **3 problemas distintos** causando los 35 errores:

1. **Columna `created_by` no existe** en `supplier_invoices` — el código la envía y Supabase la rechaza (error PGRST204)
2. **No existe constraint unique** en `(supplier_id, invoice_number)` — el upsert falla (error 42P10), y la lógica de fallback inserta el batch completo con plain insert, pero luego intenta re-insertar individualmente los mismos registros (duplicando conteo de errores)
3. **Formato de RUT inconsistente**: la tabla `suppliers` guarda RUTs con formato (e.g., `77.225.200-5`) mientras el parser normaliza quitando puntos/guiones. Esto impide el match correcto por RUT

### Cambios en `PurchaseHistoryImport.tsx`

1. **Eliminar `created_by`** de todos los objetos de inserción a `supplier_invoices` (no existe en la tabla)
2. **Simplificar la estrategia de inserción**: Usar directamente `insert` (no `upsert`) ya que no hay constraint unique. Eliminar toda la cascada de fallbacks que genera errores falsos
3. **Normalizar RUT al comparar con suppliers**: En `processPurchaseRows`, normalizar el RUT del supplier antes de comparar, para que `77.225.200-5` == `772252005`
4. **Omitir duplicados silenciosamente**: Pre-verificar facturas existentes antes del insert y saltar las que ya existen, sin contarlas como error

### Cambios en `purchaseHistoryParser.ts`

5. **Normalizar RUT de suppliers** al buscar match: cambiar la línea que compara `suppliers.find(s => normalizeRut(s.rut || '') === rut)` — esto ya está correcto, pero verificar que el match con `inventory_suppliers` también normalice

### Detalle técnico del flujo simplificado de inserción

```text
Antes (cascada de errores):
  upsert + created_by → FAIL → upsert sin created_by → FAIL (no constraint)
  → insert batch → OK pero error var set → individual retry → DUPLICATE errors

Después (directo):
  insert batch (sin created_by) → OK
  Si falla batch → insert individual → cuenta errores reales
```

### Archivos a modificar
- `src/components/finance/historical/PurchaseHistoryImport.tsx`

