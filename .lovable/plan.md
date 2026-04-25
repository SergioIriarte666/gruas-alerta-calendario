# Auditoría de cambios — Estado actual y propuesta

## Diagnóstico (lo que hay HOY)

### ✅ Servicios — SÍ tiene auditoría completa
- Tabla: `service_change_history` (875 SNAPSHOT, 336 CREATE, 2.926 UPDATE registrados).
- Trigger en BD: `trigger_track_service_changes` sobre `services` → función `track_service_changes()` registra automáticamente CREATE / UPDATE campo por campo, con `changed_by = auth.uid()`.
- UI: `useServiceChangeHistory.ts` ya consume el historial agrupado por fecha/usuario.
- Cobertura: creación, edición y snapshots periódicos.

### ⚠️ Costos — NO tiene auditoría
- No existe trigger sobre `costs`.
- La tabla `audit_log` solo registra DELETE (4 costos eliminados históricamente). No captura quién creó ni quién editó.
- El campo `created_by` en `costs` indica el autor original, pero NO hay rastro de ediciones posteriores ni de qué cambió.

### ⚠️ Compras / Inventario — NO tiene auditoría
- Sin triggers sobre `inventory_movements`, `crane_parts`, `supplier_invoices`, `cost_inventory_items`.
- Solo `created_by` (autor inicial). No hay trazabilidad de modificaciones ni de quién aprobó/editó una compra.

### Tabla `audit_log` (genérica)
- Existe pero está prácticamente vacía: 9 DELETE de pagos a proveedores, 4 DELETE de costos, 2 eventos de seguridad. No se está usando como bitácora real.

---

## Resumen ejecutivo
| Módulo | Creación (quién) | Edición (quién + qué cambió) | Eliminación |
|---|---|---|---|
| Servicios | ✅ | ✅ campo a campo | ✅ |
| Costos | ⚠️ solo `created_by` | ❌ | ✅ (audit_log) |
| Compras / Inventario | ⚠️ solo `created_by` | ❌ | ❌ |
| Facturas | ⚠️ solo `created_by` | ❌ | parcial |
| Pagos a proveedores | ⚠️ solo `created_by` | ❌ | ✅ (audit_log) |

---

## Propuesta: extender el patrón de Servicios a Costos y Compras

### 1. Nuevas tablas de historial (replicando el modelo probado de `service_change_history`)
- `cost_change_history` — registra CREATE/UPDATE/DELETE de `costs` con `cost_id`, `changed_by`, `field_name`, `old_value`, `new_value`, `change_summary`, `changed_at`.
- `inventory_movement_change_history` — mismo patrón sobre `inventory_movements` (cubre compras, salidas, consumos).
- `crane_part_change_history` — mismo patrón sobre `crane_parts` (compras de repuestos).

Todas con RLS: SELECT solo authenticated; INSERT bloqueado a usuarios (solo trigger SECURITY DEFINER); sin UPDATE/DELETE.

### 2. Triggers automáticos (BD)
- `track_cost_changes()` AFTER INSERT/UPDATE/DELETE ON `costs`.
- `track_inventory_movement_changes()` AFTER INSERT/UPDATE/DELETE ON `inventory_movements`.
- `track_crane_part_changes()` AFTER INSERT/UPDATE/DELETE ON `crane_parts`.

Cada trigger compara columnas relevantes (amount, date, description, supplier_id, category_id, payment_date, paid_amount, quantity, unit_cost, etc.) y sólo inserta filas para los campos que cambiaron, con etiquetas legibles en español.

### 3. Hooks frontend
- `useCostChangeHistory(costId)` — análogo a `useServiceChangeHistory`.
- `useInventoryMovementChangeHistory(movementId)`.
- Función helper compartida `groupChangesByDateAndUser` (ya existe, reutilizable).

### 4. UI — pestaña "Historial de cambios"
Siguiendo el patrón visual del módulo de Costos (custom-instructions del proyecto):
- Agregar pestaña **Historial** en `CostDetailsModal` y en el modal de detalle de movimiento de inventario / compra.
- Tabla agrupada por fecha + usuario, con badges (`CREATE` violeta, `UPDATE` ámbar, `DELETE` rosa) y descripción legible: "Monto cambió de $50.000 a $60.000".

### 5. Backfill (opcional)
Insertar un SNAPSHOT inicial para los costos y movimientos existentes (con `change_type='SNAPSHOT'` y `changed_by = created_by`) para que el historial muestre el estado de partida, igual que ya se hizo con servicios.

---

## Archivos involucrados
**Nuevos:**
- `supabase/migrations/<timestamp>_audit_costs_and_purchases.sql` (tablas + funciones + triggers + RLS + backfill)
- `src/hooks/useCostChangeHistory.ts`
- `src/hooks/useInventoryMovementChangeHistory.ts`
- `src/components/costs/CostChangeHistoryTab.tsx`
- `src/components/inventory/MovementChangeHistoryTab.tsx`

**Editados:**
- `src/components/costs/CostDetailsModal.tsx` — añadir pestaña Historial
- `src/components/inventory/InventoryMovementDetailsModal.tsx` (o equivalente) — añadir pestaña Historial
- `src/integrations/supabase/types.ts` — regenerado tras migración

---

## Decisiones a confirmar
1. ¿Avanzo con las **tres** tablas (costs + inventory_movements + crane_parts) o solo costos por ahora?
2. ¿Quieres también cubrir **facturas** (`invoices`) y **pagos a proveedores** (`supplier_payments`) en el mismo trabajo?
3. ¿Hago el backfill SNAPSHOT de los registros históricos para que aparezcan en el historial desde el inicio?
