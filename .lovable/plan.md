
# Plan: Corregir Sincronización Costs → Supplier Payments

## Problema Identificado

La carga XML de costos envía `supplier_id` y `payment_date` al hook `addCost`, pero el hook `useCosts.ts` **no incluye estos campos** en el objeto que se inserta en la base de datos.

### Evidencia

**XMLCostUpload.tsx (línea 397-419)** envía correctamente:
```javascript
const costData = {
  ...
  payment_date: paymentDate,
  supplier_id: supplierId,  // ← Se envía
  ...
};
```

**useCosts.ts (línea 93-110)** solo incluye:
```javascript
const validCostFields = {
  amount, category_id, crane_id, operator_id, service_id,
  date, description, notes, subcategory, service_folio,
  cost_center_id, purchase_quantity, purchase_unit_cost,
  immediate_consumption, created_by
  // ❌ Falta: supplier_id, payment_date
};
```

### Resultado

El costo "Consumo TAG" se creó con:
- `supplier_id = b3e2476e-...` (aparece en DB porque el campo existe en la tabla)
- Pero el trigger `create_supplier_payment_from_cost` **no generó el pago** porque los campos no se pasaron correctamente al INSERT

---

## Solución

### Archivo a Modificar: `src/hooks/useCosts.ts`

Agregar `supplier_id` y `payment_date` al objeto `validCostFields`:

```javascript
const validCostFields = {
  amount: validAmount,
  category_id: costData.category_id,
  crane_id: costData.crane_id,
  operator_id: costData.operator_id,
  service_id: costData.service_id,
  date: costData.date,
  description: costData.description.trim(),
  notes: costData.notes,
  subcategory: costData.subcategory,
  service_folio: costData.service_folio,
  cost_center_id: costData.cost_center_id,
  purchase_quantity: costData.purchase_quantity,
  purchase_unit_cost: costData.purchase_unit_cost,
  immediate_consumption: costData.immediate_consumption || false,
  created_by: user?.id || null,
  // AGREGAR: Campos para sincronización con proveedores
  supplier_id: costData.supplier_id || null,
  payment_date: costData.payment_date || null,
};
```

---

## Verificación Adicional

También verificaré que el costo existente "Consumo TAG" realmente tenga el `supplier_id` correcto guardado, ya que la consulta lo mostró. Si el campo ya está en la base de datos, solo necesitamos que nuevos costos lo incluyan correctamente.

---

## Pasos de Implementación

| # | Acción |
|---|--------|
| 1 | Modificar `useCosts.ts` para incluir `supplier_id` y `payment_date` en `validCostFields` |
| 2 | Probar carga XML y verificar que aparezca en Proveedores > Pagos |

---

## Resultado Esperado

Después del cambio:
1. Los costos cargados via XML con proveedor identificado aparecerán automáticamente en **Pagos a Proveedores**
2. El trigger creará registros con estado `pending` o `paid` según la fecha de pago
3. Se mantendrá trazabilidad bidireccional via `cost_id` y `supplier_payment_id`
