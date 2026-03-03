

# Plan: Sincronización Triangular Definitiva — Costos ↔ Proveedores ↔ Bodega

## Problema Actual

Existen **dos triggers bidireccionales** que causan ciclos y duplicados, más lógica manual redundante en el frontend:

```text
CICLO ACTUAL:
  Cost INSERT → trigger → crea Supplier Payment
  Supplier Payment INSERT/UPDATE → trigger → crea OTRO Cost
  Frontend (useSupplierPayments) → también crea Cost manualmente

  Bodega: parcialmente conectada vía UnifiedPurchaseService y 
  createPartCostAndInventory, pero sin triggers DB-level
```

### Problemas concretos:
1. **Trigger `create_cost_from_supplier_payment`** crea costos duplicados cuando un payment se marca como paid (y ya existía un cost vinculado vía el otro trigger).
2. **`createPartCostAndInventory`** en `useSupplierPayments.ts` inserta un cost manualmente con `supplier_payment_id`, lo que evita el trigger inverso pero duplica si el cost ya fue creado por el trigger `cost→payment`.
3. **`useDeleteCost`** no invalida queries de proveedores ni inventario — borrar un cost deja huérfanos.
4. **No hay trigger de UPDATE** cost→payment: editar monto/proveedor en costos no se refleja en pagos.
5. **Bodega desconectada** de proveedores: crear un payment con `add_to_inventory=true` crea movimiento, pero no se refleja si el costo se edita/elimina.

## Solución: Dirección Única + Sincronización Completa

```text
FLUJO PROPUESTO:

  ┌── COSTO (Fuente de Verdad financiera) ──┐
  │                                          │
  │  INSERT cost (con supplier_id)           │
  │  └► trigger MANTENER: crea payment       │
  │                                          │
  │  UPDATE cost (amount/supplier/date)      │
  │  └► NUEVO trigger: actualiza payment     │
  │                                          │
  │  DELETE cost                             │
  │  └► MEJORAR trigger: elimina payment     │
  │     + cancela movimientos inventario     │
  └──────────────────────────────────────────┘

  ┌── PROVEEDOR (Payment) ─────────────────┐
  │                                         │
  │  INSERT payment (sin cost_id)           │
  │  └► trigger MANTENER: crea cost         │
  │     (solo si NO tiene cost_id ya)       │
  │                                         │
  │  Marcar como PAID (con piezas)          │
  │  └► Frontend: usa cost_id existente,    │
  │     NO crea otro cost                   │
  │  └► Si add_to_inventory: crea           │
  │     movimiento vinculado al cost_id     │
  │                                         │
  │  DELETE payment                         │
  │  └► NUEVO trigger: desvincula cost      │
  └─────────────────────────────────────────┘

  ┌── BODEGA (Inventario) ─────────────────┐
  │                                         │
  │  Movimientos siempre vinculados con     │
  │  cost_id cuando aplica                  │
  │                                         │
  │  DELETE cost → cancela movimientos      │
  │  DELETE payment → no afecta movimientos │
  │  (movimientos viven vía cost_id)        │
  └─────────────────────────────────────────┘
```

## Implementación

### 1. Migración SQL (3 cambios en una sola migración)

**A. Reemplazar `create_cost_from_supplier_payment`**: Modificar para que SOLO cree cost si el payment NO tiene `cost_id` (es decir, fue creado manualmente desde Proveedores, no desde un costo). Si ya tiene `cost_id`, solo actualizar el cost existente con `payment_date`.

**B. Nuevo trigger `sync_cost_update_to_payment`** (AFTER UPDATE on costs): Si cambia `amount`, `supplier_id`, `description`, o `payment_date`, propagar al `supplier_payment` vinculado vía `supplier_payment_id`.

**C. Mejorar `sync_cost_supplier_payment_deletion`**: Al DELETE un cost, hacer DELETE del supplier_payment asociado (no solo NULL). También cancelar `inventory_movements` vinculados con `cost_id`.

**D. Nuevo trigger `on_supplier_payment_delete`** (BEFORE DELETE on supplier_payments): Si el payment tiene `cost_id`, desvincularlo del cost (`SET supplier_payment_id = NULL`), sin eliminar el cost.

### 2. Frontend — `useSupplierPayments.ts`

**`createPartCostAndInventory`** (líneas 171-295): Refactorizar para que:
- Primero busque si el payment ya tiene un cost vinculado (via `cost_id` en el payment).
- Si existe `cost_id`: actualizar ese cost (agregar subcategory, crane_id) en vez de crear uno nuevo.
- Si no existe: crear el cost con `supplier_payment_id` (como ahora, para evitar trigger circular).
- Mantener la lógica de `add_to_inventory` y `crane_parts` pero vinculando al `cost_id` correcto.

### 3. Frontend — `useDeleteCost.ts`

Agregar invalidación de queries de proveedores e inventario en `onSuccess`:
- `supplier-payments`, `supplier-stats`, `pending-payments`
- `inventory-movements`, `inventory-stock`, `inventory-stats`

### 4. Frontend — `useSupplierPayments.ts` → `deletePayment`

Agregar invalidación de queries de costos e inventario en `onSuccess`:
- `costs`, `service-costs`
- `inventory-movements`, `inventory-stock`

### 5. Frontend — `useSupplierPayments.ts` → `createPayment`

Agregar invalidación de costos en `onSuccess` (el trigger crea un cost):
- `costs`, `crane-costs`

## Resultado Esperado

- **Crear cost con supplier_id** → Auto-crea payment → UI de proveedores se actualiza
- **Crear payment sin cost** → Auto-crea cost → UI de costos se actualiza
- **Crear payment con piezas + inventario** → Crea cost + movimiento bodega → Todo sincronizado
- **Editar cost** → Payment se actualiza automáticamente
- **Eliminar cost** → Payment se elimina + movimientos se cancelan
- **Eliminar payment** → Cost se desvincula (no se borra, puede tener otros usos)
- **Cero duplicados** en cualquier dirección

