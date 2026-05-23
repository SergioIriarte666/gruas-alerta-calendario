## Plan

1. **Hacer visible el botón de impresión en el detalle real que estás usando**
   - El botón fue agregado al componente antiguo `CostDetailsModal`, pero la captura muestra otro detalle visual (`ConsolidatedCostDetails`).
   - Agregaré el botón **Imprimir** en el encabezado del detalle consolidado, junto al monto/cierre, usando el mismo generador PDF ya creado.
   - Mantendré estado de carga y aviso de éxito/error.

2. **Corregir el contador de 1000 costos**
   - El contador muestra 1000 porque `useCosts()` consulta Supabase sin paginación explícita; Supabase devuelve máximo 1000 filas por defecto.
   - Cambiaré la carga de costos para traer todas las páginas en bloques seguros, manteniendo los mismos joins y orden actual.
   - Así el contador, filtros y exportación trabajarán con el total real cargado, no solo con los primeros 1000.

3. **Validación**
   - Revisaré que `/costs` compile visualmente sin romper el patrón del módulo de costos.
   - Confirmaré que el botón aparezca en el modal/detalle mostrado en tu captura y que la fuente de datos ya no quede limitada a 1000 registros.

## Archivos a tocar

- `src/components/costs/ConsolidatedCostDetails.tsx`
- `src/hooks/useCosts.ts`

## Fuera de alcance

- No cambiaré reglas de negocio ni datos existentes.
- No modificaré el formato del PDF salvo lo mínimo necesario para reutilizarlo desde el detalle correcto.