

# Plan: Corregir valores de consumo de inventario y errores de build

## Problema Principal
En la vista "Consumos de Inventario" de una grúa, los valores se muestran **sin IVA** (neto: $10.916) mientras que el costo asociado muestra el valor **con IVA** ($12.990). Esto confunde al usuario porque ambos registros corresponden al mismo ítem pero muestran montos distintos.

**Causa raíz**: Los movimientos de inventario (`inventory_movements`) almacenan `unit_cost` y `total_cost` como valores **netos**. El formulario de salida (`SimpleExitForm`) toma el costo de la última entrada (también neto). Las funciones `getDisplayUnitCost` y `getDisplayTotalCost` intentan leer primero de `supplier_invoice_items.total_amount` (que sí incluye IVA), pero cuando no hay vínculo a una factura, caen al fallback de `movement.unit_cost` (neto).

## Solución

### 1. Corregir display en CraneParts.tsx
**Archivo**: `src/components/cranes/CraneParts.tsx`

Modificar `getDisplayUnitCost` y `getDisplayTotalCost` para que, cuando caigan al fallback de `movement.unit_cost`/`total_cost`, multipliquen por 1.19 (IVA 19%) para mostrar el valor total consistente con lo que muestra el módulo de costos.

```
// Fallback final: aplicar IVA al valor neto almacenado
const netCost = movement.unit_cost || 0;
return Math.round(netCost * 1.19);
```

### 2. Corregir error de build en send-daily-pending-report
**Archivo**: `supabase/functions/send-daily-pending-report/index.ts`

Cambiar `content_type` por el nombre de propiedad correcto del SDK Resend para adjuntos. La propiedad `content_type` no existe en el tipo `Attachment` de Resend.

## Impacto
- Solo cambia la **capa de visualización**, no se modifican datos almacenados
- No afecta costos, comisiones ni otros módulos
- Los valores mostrados serán consistentes entre "Detalle de Costos" y "Consumos de Inventario"

