
## Diagnóstico — Caso "Optico Derecho Mack Vision"

### Datos en BD (lo que pasó)
- **Costo** `2f1810c5...` creado el 2026-05-07:
  - `amount = 299.768`
  - `purchase_unit_cost = 299.768`
  - **`purchase_quantity = NULL`** ← causa raíz
  - `immediate_consumption = true`
  - `crane_id` = sí (asignada)
  - `inventory_movement_id = NULL`
  - Subcategoría: **"Partes y Piezas"** (categoría **Inventario**)
- **`inventory_items`**: el ítem "Optico Derecho Mack Vision" (SKU `ATPACC0046`) sí existe (creado el 03-abr).
- **`inventory_movements`**: ningún movimiento referencia ese ítem (sólo existe el del Óptico Izquierdo, registrado bien en abril).
- **`crane_parts`**: no hay registro para esta compra.
- **`supplier_payments`**: sí se creó el pago al proveedor — esa parte sincronizó.

### Por qué falló la sincronización
1. El formulario muestra `InventoryPurchaseFields` cuando la **categoría = "Inventario"**, sin importar la subcategoría.
2. La validación obligatoria de `purchase_quantity > 0` en `CostForm.tsx` (líneas 378-389) sólo se ejecuta si `subcategoryConfig.routes_to_inventory === true`.
3. La subcategoría **"Partes y Piezas"** (categoría Inventario) tiene `routes_to_inventory = false` en `cost_subcategories` → la validación se saltó.
4. El usuario guardó con `purchase_quantity` vacío (probablemente sólo llenó precio unitario, que se igualó al monto total).
5. En `onSuccess` (líneas 451-454, 571-574) la condición `isInventoryPurchase` exige `purchase_quantity > 0`. Como es null → **no se llama a `UnifiedPurchaseService.registerForExistingCost`** → no se crea movimiento de bodega ni `crane_parts`.
6. El costo quedó guardado pero "huérfano" respecto al inventario, aunque visualmente el toggle "Consumo Inmediato" estaba activo.

### Resultado visible
- En **Costos**: aparece normal, con consumo inmediato + grúa.
- En **Bodega/Movimientos**: no existe (cantidad nunca se descontó).
- En **Grúa → Bitácora/Partes**: no aparece la pieza consumida.
- En **Pago a proveedor**: sí está registrado (esa parte usa otra ruta).

---

## Plan de corrección

### Parte A — Fix en código (prevenir nuevos casos)

**Archivo: `src/components/costs/CostForm.tsx`**

Cambiar la validación para que dependa de la **categoría = Inventario** (o de tener `purchase_unit_cost`/`immediate_consumption` activado), no sólo del flag `routes_to_inventory` de la subcategoría:

```text
si (categoría == "Inventario") O (immediate_consumption == true)
   → exigir purchase_quantity > 0  AND  purchase_unit_cost > 0
```

Adicionalmente, si `immediate_consumption=true` y faltan `purchase_quantity`/`purchase_unit_cost`, bloquear el submit con toast claro: *"Debes indicar cantidad y precio unitario para registrar el consumo en bodega y grúa."*

**Archivo: `src/components/costs/form/InventoryPurchaseFields.tsx`**

Marcar visualmente `purchase_quantity` y `purchase_unit_cost` como obligatorios cuando `immediate_consumption=true`, e impedir `setValue('amount', total)` hasta tener ambos (ya está, pero añadir aviso si falta uno).

### Parte B — Reparación del registro existente

Para "Optico Derecho Mack Vision" del 29-abr (cost_id `2f1810c5-c2fc-4cb2-8746-21d12f480471`), opciones:

1. **Reparación automática vía RPC** (recomendado): crear/usar un RPC `repair_immediate_consumption_cost(cost_id, quantity)` que:
   - Asuma `quantity = 1` (ya que `purchase_unit_cost == amount`).
   - Cree movimiento `entry` y `exit` en `inventory_movements` ligados al cost y crane.
   - Cree `crane_parts` con `quantity = -1`.
   - Actualice `costs.purchase_quantity = 1` y `costs.inventory_movement_id`.
2. **Manual desde UI**: editar el costo, ingresar `purchase_quantity = 1`, guardar; el flujo corregido lo sincronizará.

Recomiendo la opción 2 (manual) para este caso puntual y dejar el fix de código para evitar futuros casos. Si encontramos más costos huérfanos del mismo patrón, agregamos un script de reparación masiva.

### Parte C — Auditoría de huérfanos

Consulta para detectar casos similares (no incluida como cambio, sólo diagnóstico):
```sql
SELECT id, date, description, amount, purchase_unit_cost
FROM costs
WHERE immediate_consumption = true
  AND inventory_movement_id IS NULL
  AND (purchase_quantity IS NULL OR purchase_quantity = 0)
  AND category_id = '571b8c17-b959-4e0f-b76b-30d9587602e2';
```

---

## Archivos a modificar
- `src/components/costs/CostForm.tsx` — endurecer validación.
- `src/components/costs/form/InventoryPurchaseFields.tsx` — marcar campos como requeridos cuando aplica.

Sin migración de DB necesaria para el fix preventivo. La reparación del registro afectado puede hacerse desde la UI tras el fix.
