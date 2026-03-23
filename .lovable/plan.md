

## Plan: Corregir 4 problemas de sincronización y triggers duplicados

### Contexto

El sistema tiene triggers duplicados que ejecutan la misma lógica dos veces, y falta sincronización de UPDATE desde `supplier_payments` hacia `costs`.

### Estado actual de triggers problemáticos

| Tabla | Duplicados | Problema |
|-------|-----------|----------|
| `costs` (INSERT) | `create_supplier_payment_from_cost` + `create_supplier_payment_from_cost_trigger` | Misma función ejecutada 2 veces → posibles duplicados |
| `crane_parts` (INSERT) | `sync_parts_purchase_to_inventory_trigger` + `sync_parts_to_inventory_trigger` | Misma función ejecutada 2 veces → movimientos duplicados |
| `costs` (DELETE) | `sync_cost_deletion_cascade_trigger` + `trigger_sync_cost_deletion` | Funciones diferentes con lógica solapada |
| `supplier_payments` (UPDATE) | — | Falta sync hacia `costs` cuando se edita monto/fecha/descripción |

### Solución: 1 migración SQL

**1. Eliminar trigger duplicado en `costs` INSERT:**
- DROP `create_supplier_payment_from_cost_trigger` (el original limitado a INSERT)
- Mantener `create_supplier_payment_from_cost` (maneja INSERT + UPDATE + DELETE)

**2. Eliminar trigger duplicado en `crane_parts` INSERT:**
- DROP `sync_parts_to_inventory_trigger`
- Mantener `sync_parts_purchase_to_inventory_trigger`

**3. Consolidar triggers DELETE en `costs`:**
- DROP `trigger_sync_cost_deletion` (función más simple/obsoleta)
- Mantener `sync_cost_deletion_cascade_trigger` (función más completa que ya maneja supplier_payments + inventory_movements)

**4. Crear sync UPDATE `supplier_payments → costs`:**
```sql
CREATE FUNCTION sync_supplier_payment_update_to_cost()
-- Cuando se edita amount, due_date, description en supplier_payments
-- Propagar a costs vinculado (via cost_id o supplier_payment_id)
```

**5. Agregar trigger DELETE en `supplier_invoices`:**
```sql
-- Al eliminar una factura, desvincular los payments asociados
UPDATE supplier_payments SET supplier_invoice_id = NULL
WHERE supplier_invoice_id = OLD.id;
```

### Archivo

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | DROP triggers duplicados + crear sync payment→cost + DELETE invoice cleanup |

### Lo que NO se toca

- Lógica de `create_supplier_payment_from_cost()` (función) — solo se elimina el trigger duplicado
- `sync_parts_purchase_to_inventory()` (función) — solo se elimina el trigger duplicado
- Ningún hook de frontend — la sincronización es a nivel DB
- Triggers de costos de servicios, comisiones, inventario — intactos

