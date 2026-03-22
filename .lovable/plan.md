

## Plan: Preservar estado de pago al editar costos

### Problema

Cuando se edita un costo que ya está pagado (tiene `payment_date`), el formulario no inicializa el campo `is_paid` con el valor correcto. El `reset()` en línea 190 nunca establece `is_paid`, así que queda en `false` (el default del schema). Al guardar, la línea 317 evalúa `is_paid ? values.date : null`, resultando en `payment_date: null` — borrando el estado de pago.

### Solución

Agregar `is_paid: !!cost.payment_date` en el `reset()` cuando se edita un costo existente (línea 211 de `CostForm.tsx`).

Adicionalmente, ajustar la lógica de submit para que al guardar preserve el `payment_date` original si el costo ya estaba pagado y el usuario no desmarcó el checkbox:
- Si `is_paid` está marcado → usar `cost.payment_date` existente o `values.date` como fallback
- Si `is_paid` está desmarcado → `null`

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/CostForm.tsx` | Agregar `is_paid: !!cost.payment_date` en el reset (línea ~211), y preservar `payment_date` original en submit (línea ~317) |

### Detalle técnico

```typescript
// En reset() al editar (línea ~211):
is_paid: !!cost.payment_date,

// En submit (línea ~317):
payment_date: is_paid ? (cost?.payment_date || values.date) : null,
```

