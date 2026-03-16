

## Mover Total Cotización al badge y quitar columna

### Cambio

1. **Quitar columna "Total Cotización"** de la tabla (header línea 175 y celda líneas 222-227).
2. **Agregar el total de la cotización** como un badge al lado de "coincidencias" (línea ~144), mostrando el valor neto total de la primera cotización parseada (ya que todas las filas comparten la misma cotización en este caso).

El badge se verá algo como:
```
✓ 5 coincidencias   💰 Total Cot: $200.000
```

### Archivo a modificar
- `src/components/vip/QuotePDFImporter.tsx`
  - Línea 144: Agregar badge con total de cotización después del badge de coincidencias
  - Línea 175: Eliminar `<TableHead>` de "Total Cotización"
  - Líneas 222-227: Eliminar `<TableCell>` de "Total Cotización"

