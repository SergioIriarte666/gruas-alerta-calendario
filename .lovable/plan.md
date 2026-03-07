

## Diagnóstico

Febrero 2025 muestra $0 en ventas porque **no existen facturas con fecha de febrero 2025 en la base de datos**. El archivo Libro de Ventas importado saltó de Enero 2025 directamente a Marzo 2025. No es un error de código — es un vacío en los datos importados.

Resumen de datos por mes (ventas):
```text
Ene 25: 82 facturas → $36.4M (todas importadas)
Feb 25: 0 facturas → $0 ← VACÍO
Mar 25: 49 facturas → $35.0M (todas importadas)
Abr 25: 49 facturas → $23.4M (todas importadas)
```

### Opciones para resolver

**Opción A — Reimportar el Libro de Ventas de Febrero 2025**: Subir el archivo que contenga los datos de ese mes. El sistema detectará duplicados automáticamente para los otros meses.

**Opción B — Agregar alerta visual en el dashboard**: Modificar el componente `HistoricalResults.tsx` para que la tabla de Resumen Mensual muestre un indicador visual cuando un mes tiene $0 en ventas pero meses adyacentes tienen datos, sugiriendo que podría faltar información importada. Sería un badge tipo "⚠ Sin datos" en la celda de ventas.

### Cambios técnicos (Opción B)

**`src/components/finance/historical/HistoricalResults.tsx`** — En la sección de tabla de Resumen Mensual:
- Agregar lógica que detecte meses con ventas = $0 cuando los meses anterior y posterior tienen ventas > 0
- Mostrar un badge `"Sin datos - ¿Falta importación?"` en color amber/warning en esos meses
- Mantener la alerta de margen negativo existente

La Opción A (reimportar) es la solución definitiva. La Opción B es un complemento visual útil. Ambas se pueden hacer.

