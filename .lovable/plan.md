

## Plan: Sincronizar `paid_date` / `payment_date` bidireccionalmente

### Problema

El costo muestra `payment_date = 21/03/2026` pero el pago de proveedor muestra `paid_date = 23/03/2026`. Son dos campos distintos en dos tablas que no se sincronizan entre sí:

- **costs.payment_date** → fecha de pago del costo
- **supplier_payments.paid_date** → fecha de pago del proveedor

Los triggers actuales sincronizan `amount`, `due_date`, `description`, pero **omiten completamente `paid_date` ↔ `payment_date`**.

### Triggers afectados

| Trigger | Dirección | Falta |
|---------|-----------|-------|
| `create_supplier_payment_from_cost` (UPDATE) | Cost → Payment | Ya sincroniza `paid_date` cuando hay `payment_date` ✓ |
| `sync_supplier_payment_update_to_cost` | Payment → Cost | **NO sincroniza `paid_date` → `payment_date`** ✗ |
| `sync_supplier_invoice_update` | Invoice → Payment → Cost | **NO sincroniza `payment_date`** (no aplica directamente) |

### Solución: 1 migración SQL

Actualizar `sync_supplier_payment_update_to_cost` para incluir la sincronización de `paid_date` → `costs.payment_date`:

```sql
-- Agregar paid_date al check de cambios
IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
   (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
   (OLD.description IS DISTINCT FROM NEW.description) OR
   (OLD.paid_date IS DISTINCT FROM NEW.paid_date) THEN

  UPDATE costs SET
    amount = ...,
    date = ...,
    description = ...,
    payment_date = CASE WHEN OLD.paid_date IS DISTINCT FROM NEW.paid_date THEN NEW.paid_date ELSE payment_date END,
    updated_at = now()
  WHERE supplier_payment_id = NEW.id;
  -- (mismo para cost_id)
```

Adicionalmente, corregir los datos existentes inconsistentes: actualizar `costs.payment_date` desde `supplier_payments.paid_date` donde difieran y estén vinculados.

### Archivo

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Actualizar función `sync_supplier_payment_update_to_cost` + data fix para registros existentes |

### Resultado

Editar la fecha de pago en Proveedores actualizará automáticamente la fecha de pago en Costos, y viceversa (el trigger cost→payment ya existe). Bidireccionalidad completa.

