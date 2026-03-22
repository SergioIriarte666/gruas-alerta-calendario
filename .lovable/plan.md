

## Plan: Backfill de movimientos de inventario para costos huérfanos con consumo inmediato

### Problema

Hay 8 costos con `immediate_consumption=true` que nunca generaron movimientos de inventario ni registros en `crane_parts`. Algunos (Aceite Hidráulico, Filtro, Mangueras) sí tienen movimientos pero el campo `costs.inventory_movement_id` no se actualizó. Otros (Bornes Baterias, Cubre Volante, Aceite Hidraulico equipo grua, Manguera Hidraulico, Aceite Hidraulico Implementos) no tienen movimientos en absoluto.

El sistema de Piezas ya funciona correctamente: muestra automáticamente los consumos de inventario (`inventory_movements` tipo `exit` con `crane_id`). El problema es que estos registros huérfanos nunca se crearon.

### Solución

Una migración SQL que:

1. **Para costos que YA tienen movimientos** (3 registros): actualizar `costs.inventory_movement_id` con el ID del movimiento de entrada correspondiente
2. **Para costos SIN movimientos** (5 registros): crear los movimientos de entrada y salida + registro en `crane_parts`, y vincularlos al costo

### Archivos

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Backfill: crear movimientos de inventario y crane_parts para costos huérfanos con consumo inmediato |

### Registros afectados

- **Bornes Baterias** (DSBZ-85) — 6 uds x $5,000 — sin movimientos
- **Aceite Hidraulico Implementos S.A.** (TLYF-23) — sin movimientos (sin quantity)
- **Manguera Hidraulico** (TLYF-23) — sin movimientos  
- **Cubre Volante y Ampolletas 24V** (TLYF-23) — sin movimientos
- **Aceite Hidraulico equipo grua** (FYTR-49) — sin movimientos
- **Aceite Hidraulico** (TDCJ-46) — ya tiene movimientos, solo falta vincular
- **Filtro Hidraulico Plataforma** (TDCJ-46) — ya tiene movimientos, solo falta vincular
- **Mangueras Hidraulico** (TLYF-23) — ya tiene movimientos, solo falta vincular

### Resultado

Todos los consumos aparecerán automáticamente en la pestaña **Piezas** de cada grúa como bitácora de lo instalado/reemplazado, gracias al sistema existente en `useCraneParts` que ya lee los `inventory_movements` tipo `exit`.

