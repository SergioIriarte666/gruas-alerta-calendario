

## Plan: Agrupar por Cliente en el Reporte de Pendientes

### Problema
Actualmente las secciones del reporte (Sin OC, Sin Cotización, Pendientes de Facturar, Pendientes de Cierre) ordenan por fecha, mezclando todos los clientes. Esto dificulta la lectura.

### Solución
Modificar `src/utils/pdf/pendingReportPDF.ts` para que cada sección agrupe los registros por cliente alfabéticamente, y dentro de cada cliente ordene por fecha. Se usará un sub-encabezado visual (fila coloreada con el nombre del cliente) para separar los grupos.

### Cambios en `src/utils/pdf/pendingReportPDF.ts`

1. **Crear función helper `groupByClient`**: Recibe un array de filas `[folio, cliente, fecha, días, ...]` y retorna el mismo array reordenado: primero agrupa por la columna "Cliente" (índice 1), ordena los grupos alfabéticamente, y dentro de cada grupo mantiene el orden por fecha.

2. **Modificar `addSection`** para aceptar un flag `groupByClient` que inserte filas de sub-encabezado con el nombre del cliente (fondo gris oscuro, texto bold, colspan visual) antes de cada grupo. Esto crea separación visual clara.

3. **Aplicar agrupación** a las 5 secciones que tienen columna "Cliente":
   - Servicios Pendientes de Facturar
   - Servicios sin Orden de Compra
   - Servicios sin Cotización
   - Facturas Pendientes de Pago
   - Servicios Pendientes de Cierre

4. **Servicios del Día** también se agrupará por cliente.

### Resultado Visual
```text
2. Servicios sin Orden de Compra (15)
┌─────────────────────────────────────┐
│ ▶ Cliente ABC (5)                   │  ← sub-header row
├───────┬────────────┬───────┬────────┤
│ Folio │ Fecha      │ Días  │        │
│ SRV-1 │ 01/01/2026 │ 60    │        │
│ SRV-2 │ 05/01/2026 │ 56    │        │
│ ...   │            │       │        │
├─────────────────────────────────────┤
│ ▶ Cliente XYZ (3)                   │  ← sub-header row
├───────┬────────────┬───────┬────────┤
│ SRV-8 │ 10/02/2026 │ 20    │        │
│ ...   │            │       │        │
└───────┴────────────┴───────┴────────┘
```

La columna "Cliente" se elimina de las filas individuales (ya que el sub-header la muestra) para ganar espacio horizontal, o se mantiene si se prefiere redundancia. Optaré por **mantenerla** para que cada fila sea auto-contenida, pero el agrupamiento visual hará que sea fácil de leer.

### Archivos a modificar
- `src/utils/pdf/pendingReportPDF.ts` — única modificación

