
# Plan: Corregir error al importar XML a Bodega y dejar seguro el segundo intento

## Diagnóstico confirmado
El problema no parece ser el XML. En `src/components/inventory/XMLInventoryUpload.tsx`, cuando la importación tiene “consumo inmediato”, se inserta un registro en `crane_parts` enviando `total_value`.

Pero en la base de datos `crane_parts.total_value` está tratado como columna calculada/generada, por eso Postgres rechaza cualquier valor explícito con este error:

```text
cannot insert a non-DEFAULT value into column "total_value"
```

Además, el flujo actual inserta factura, costo, pago y movimientos antes de llegar a `crane_parts`, y si falla en esa etapa no hay rollback real. Por eso un segundo intento puede quedar sucio o inconsistente.

## Qué voy a implementar
1. Eliminar `total_value` de los `insert` y `update` hacia `crane_parts` en el flujo XML.
2. Revisar y corregir otros puntos del proyecto que escriben en `crane_parts` con el mismo patrón, para que el error no reaparezca en otros módulos.
3. Agregar limpieza compensatoria por documento importado cuando una importación falle a mitad de proceso, para que el reintento quede limpio.

## Archivos principales a corregir
- `src/components/inventory/XMLInventoryUpload.tsx`
  - quitar `total_value` del insert de `crane_parts`
  - mantener el valor visual vía `unit_price`/`quantity`, dejando que la BD calcule `total_value`
  - encapsular la importación por documento con rollback manual si falla una línea
- `src/services/UnifiedPurchaseService.ts`
  - quitar `total_value` de payloads de `crane_parts` en `insert` y `update`

## Diseño del reintento
El flujo quedará conceptualmente así:

```text
crear factura
crear costo
crear pago proveedor
crear líneas de factura
crear movimientos de inventario
crear crane_parts
si algo falla:
  borrar en orden inverso lo creado para ese documento
```

Eso evita:
- documentos a medio crear
- bloqueo del segundo intento
- duplicidad de costos/movimientos por reintentos fallidos

## Detalles técnicos
- La causa raíz está en la inserción actual de `XMLInventoryUpload.tsx`, donde se manda:
  - `unit_price: displayUnitPrice`
  - `total_value: movementTotalWithTax`
- También detecté el mismo riesgo en `UnifiedPurchaseService.ts`, donde `cranePartPayload` incluye `total_value` y luego se usa tanto en `insert` como en `update`.
- No hace falta rediseñar la UI; la corrección es de persistencia y consistencia del flujo.

## Resultado esperado
- La importación XML a bodega con consumo inmediato vuelve a funcionar.
- Si el primer intento falla, el segundo ya no queda contaminado por datos parciales.
- La trazabilidad con Costos, Proveedores e Inventario se mantiene intacta.
