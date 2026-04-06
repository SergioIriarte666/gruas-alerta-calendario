

# Plan: Refinar reporte de movimientos de grúa

## Problemas identificados

1. **Movimientos cancelados aparecen en el reporte** — La query no filtra por `status = 'active'`, mostrando registros cancelled que confunden.
2. **Observaciones muestran IDs de costo** — El texto dice "costo ID: 874040de-..." en vez de mostrar el monto del costo.

## Cambios

### Archivo: `src/components/cranes/CraneInventoryTab.tsx`

1. **Filtrar movimientos cancelados en la query** (línea ~173): Agregar `.eq('status', 'active')` a la query de `inventory_movements` para que solo traiga movimientos activos.

2. **Eliminar columna "Estado"**: Ya no tiene sentido mostrarla si todos serán `active`. Se remueve del `head` y del array de cada fila.

3. **Reemplazar IDs de costo por montos en Observaciones** (línea ~383): En la construcción de `notes`, detectar el patrón `costo ID: <uuid>` y reemplazarlo con el monto real del costo. Para esto:
   - Incluir `amount` en la query de `costs` referenciada, o bien usar el `total_cost` / `unit_cost` ya disponible en el movimiento.
   - Dado que el movimiento ya tiene `unit_cost` y `quantity` (y `total_cost`), se puede reemplazar la referencia al ID por el valor formateado: `"Costo: $XX.XXX"`.
   - Limpiar también textos como `[Costo eliminado]` que ya no aplican (esos movimientos cancelled ya no aparecerán).

4. **Ajuste en deduplicación**: La lógica `inventoryMovementsDeduped` ya no necesita manejar cancelled porque no llegarán de la query.

### Lo que NO se toca
- Lógica de mantenciones
- Hooks, servicios, base de datos
- Otros módulos
- Funcionalidad existente de importación XML, costos, bodega

