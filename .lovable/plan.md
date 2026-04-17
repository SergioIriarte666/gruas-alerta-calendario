

# Plan: Corregir parser XML + reparar 8 movimientos descuadrados

## Contexto
Diagnóstico ya validado: en importación XML con consumo inmediato, las **entradas** usan `MontoItem/Qty` (neto con descuento) pero las **salidas** usan `PrcItem` (bruto sin descuento). Resultado: salida > entrada por el monto del descuento de línea.

Folios afectados confirmados: **5245639** y **5246554** (8 movimientos en total: 4 entradas + 4 salidas).

## Cambios

### 1. Fix del parser (previene futuros casos)
**Archivo**: `src/utils/xmlParser/xmlSupplierParser.ts` (línea ~505)

Cambiar:
```ts
unit_price: precio,  // PrcItem bruto
```
Por:
```ts
unit_price: cantidad > 0 ? subtotal / cantidad : precio,  // MontoItem/Qty neto
```

Esto garantiza que el `unit_price` que se propaga al flujo (entrada, salida, costos, glosa) ya venga con el descuento aplicado. El `PrcItem` queda solo como dato informativo si se necesita.

### 2. Corrección de los 8 movimientos existentes
**Migración SQL puntual** que actualiza solo las **salidas** de los folios 5245639 y 5246554 para igualar el `unit_cost` y `total_cost` de su entrada correspondiente (mismo `cost_id` + `item_id`).

Lógica:
```sql
UPDATE inventory_movements exit
SET unit_cost = entry.unit_cost,
    total_cost = entry.unit_cost * exit.quantity
FROM inventory_movements entry
WHERE exit.movement_type = 'exit'
  AND entry.movement_type = 'entry'
  AND exit.cost_id = entry.cost_id
  AND exit.item_id = entry.item_id
  AND exit.cost_id IN (
    SELECT id FROM costs WHERE document_number IN ('5245639', '5246554')
  );
```

Solo afecta a los 4 movimientos de salida de esos 2 folios. Las entradas no se tocan (ya están correctas).

### 3. Validación post-corrección
Consulta de verificación que confirme que entrada y salida de cada par tienen el mismo `unit_cost` y `total_cost` para ambos folios.

## Lo que NO se toca
- Importador XML general (solo 1 línea cambia)
- Triggers de stock
- Lógica triangular costo↔pago↔factura
- Cualquier otro folio histórico (alcance limitado a los 2 folios reportados)

## Archivos involucrados
- `src/utils/xmlParser/xmlSupplierParser.ts` (1 línea)
- 1 migración SQL puntual (UPDATE acotado a 4 filas)

## Resultado
- Próximas importaciones XML: entradas y salidas cuadran automáticamente
- Los 8 movimientos actuales: las salidas se igualan a las entradas (descuento aplicado correctamente)
- Inventario y costos quedan consistentes con el valor neto de la factura

