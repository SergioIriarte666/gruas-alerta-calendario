

## Diagnóstico

Las facturas 4109, 4115 y la nota de crédito 183 muestran el badge **"Histórica"** porque fueron importadas desde el Libro de Ventas del SII y su folio interno tiene prefijo `HIST-` (ej: `HIST-F-4109`). El badge actual usa esa lógica: `folio.startsWith('HIST-')` = "Histórica", todo lo demás = "App".

El problema es que **"Histórica"** implica que son registros antiguos, cuando en realidad son facturas recientes que simplemente fueron **importadas** desde un archivo externo.

## Solución

Cambiar el badge de **"Histórica"** a **"Importada"** para reflejar correctamente el origen del registro. Opcionalmente, usar un color más neutro (azul) para diferenciarlo del badge verde "App".

### Cambios

**`src/components/finance/historical/HistoricalSalesTable.tsx`** (líneas 189-192):
- Cambiar el texto del badge de `Histórica` → `Importada`
- Cambiar colores a azul neutro (`bg-blue-50 text-blue-700 border-blue-200`) para que no sugiera antigüedad

**`src/components/finance/historical/HistoricalSalesPipelineView.tsx`** (línea 185):
- Cambiar la etiqueta de agrupación de `'Histórico'` → `'Importado'` para consistencia

Estos son los únicos dos archivos que usan la etiqueta "Histórica/Histórico" asociada al prefijo `HIST-`.

