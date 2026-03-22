

## Plan: Auto-marcar gastos como pagados al crearlos desde el modal de servicios

### Problema

Cuando se crean costos desde el formulario de servicios (peajes, viáticos, combustible, etc.), estos quedan sin `payment_date`, es decir, como "no pagados". Estos gastos operativos se pagan en el momento, por lo que deberían marcarse automáticamente como pagados.

Las comisiones NO deben verse afectadas — se gestionan exclusivamente desde su propio módulo.

### Solución

Agregar `payment_date` con la fecha del costo al momento de crearlo, en los dos puntos donde se generan costos desde servicios:

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/services/form/ServiceCostDetailsSection.tsx` | Agregar `payment_date: costData.date` en el objeto `costData` (línea ~217) al crear nuevos costos |
| `src/components/costs/ServiceExpenseModals.tsx` | Agregar `payment_date: baseData.date` en el objeto `costData` (línea ~108) |

### Detalle técnico

**ServiceCostDetailsSection.tsx** (línea ~210-218):
```typescript
const costData = {
  service_id: serviceId,
  category_id: costDetail.category_id,
  description: costDetail.description.trim(),
  amount: costDetail.amount,
  date: costDetail.isExisting && costDetail.date ? costDetail.date : (serviceDate || getCurrentChileDateString()),
  notes: costDetail.notes || '',
  subcategory: costDetail.subcategory || '',
  payment_date: costDetail.isExisting && costDetail.date ? costDetail.date : (serviceDate || getCurrentChileDateString()), // ← nuevo
};
```

**ServiceExpenseModals.tsx** (línea ~98-109):
```typescript
const costData: CostFormData = {
  date: baseData.date,
  description: getDefaultDescription(subcategoryName),
  amount: parseFloat(val),
  category_id: baseData.category_id,
  crane_id: baseData.crane_id === 'none' ? null : baseData.crane_id,
  operator_id: baseData.operator_id === 'none' ? null : baseData.operator_id,
  service_id: baseData.service_id === 'none' ? null : baseData.service_id,
  service_folio: baseData.service_folio || null,
  subcategory: subcategoryName,
  notes: null,
  payment_date: baseData.date, // ← nuevo: marcar como pagado automáticamente
};
```

### Lo que NO se modifica

- Comisiones: se crean y pagan desde su propio módulo, sin cambios
- Costos creados desde el módulo de Costos directamente: mantienen su lógica actual con checkbox

