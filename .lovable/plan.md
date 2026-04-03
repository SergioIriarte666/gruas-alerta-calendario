

# Plan: Agregar boton para descartar items individuales en importacion XML

## Problema
Items con valor $0 o sin coincidencia bloquean la importacion completa del documento. No hay forma de descartarlos individualmente.

## Solucion

### Archivo: `src/components/inventory/XMLInventoryUpload.tsx`

1. **Nuevo estado** `discardedLines`: Un `Set<string>` que almacena las keys de lineas descartadas (usando el `line.key` existente).

2. **Boton "Descartar" por fila**: Agregar una columna "Acciones" a la tabla con un boton `X` (icono Trash2 o X) que agrega la key al set de descartados. Si ya esta descartada, mostrar boton "Restaurar".

3. **Visual de linea descartada**: Aplicar `opacity-40 line-through` al `<tr>` cuando la linea esta descartada, para que sea obvio visualmente.

4. **Filtrar lineas descartadas en la validacion**: En el `useMemo` de `validatedDocuments` (linea ~408-430), excluir las lineas descartadas del calculo de `errors` y de `lines` efectivas. Asi el documento puede pasar a `isValid: true` sin las lineas problematicas.

5. **Filtrar en la importacion**: En la funcion de importacion (~linea 1041-1070), filtrar `validatedDoc.lines` para excluir las descartadas antes de crear los payloads.

6. **Recalcular totales**: Los badges de cantidad de lineas y monto total deben reflejar solo las lineas activas (no descartadas).

## Lo que NO se toca
- Logica de matching, creacion de productos, movimientos de bodega
- Hooks, servicios, base de datos
- Otros modulos

