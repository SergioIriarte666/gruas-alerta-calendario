

## Agregar columnas de valores al importador de cotizaciones

### Cambio

En `src/components/vip/QuotePDFImporter.tsx`, agregar dos columnas nuevas a la tabla de preview:

1. **"Valor Servicio"** — Muestra `match.parsedItem.amount` (el valor neto de cada línea del PDF) formateado con `formatCurrency`.
2. **"Valor Total Cot."** — Muestra el total general de la cotización. Para obtenerlo, se necesita cruzar con `state.parsedQuotes` usando `match.quoteNumber`.

### Implementación

1. En la sección `state.step === 'preview'`, agregar al `<TableHeader>` dos columnas: `Valor Servicio` y `Total Cotización`.
2. En cada `<TableRow>`, agregar las celdas correspondientes con `formatCurrency(match.parsedItem.amount)` y el total de la cotización asociada.
3. Debajo de la tabla (o en los badges), mostrar el total general sumando todos los `parsedItem.amount` de los matches seleccionados.
4. Calcular el total de la cotización buscando en `state.parsedQuotes` por `quoteNumber` y usando `quote.totals.neto` (o `totals.total` para IVA incluido).

### Archivos a modificar
- `src/components/vip/QuotePDFImporter.tsx` — Agregar columnas de valor a la tabla y el import de `formatCurrency`.

