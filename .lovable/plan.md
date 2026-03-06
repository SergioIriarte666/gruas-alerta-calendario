

## Plan: Adaptar parser al formato "Libro de Ventas" con soporte para Notas de Crédito y Débito

### Problema
El parser actual espera un archivo con ~19 columnas con headers específicos. El archivo real del usuario es un **Libro de Ventas** con estructura de secciones:
- Filas de sección que definen el tipo: "FACTURA ELECTRONICA", "NOTA DE CREDITO ELECTRONICA", "NOTA DE DEBITO ELECTRONICA"
- 7 columnas de datos: Nº, FOLIO, FECHA, CLIENTE RAZON SOCIAL, R.U.T, EXENTO, NETO, I.V.A., TOTAL
- Fechas en formato DD/MM/YY (2 dígitos)
- Montos negativos entre paréntesis: `(181000)`
- Filas de subtotales y "TOTAL GENERAL" que deben ignorarse

Las notas de crédito/débito deben importarse porque afectan la contabilidad. Sin ellas se duplica información de montos.

### Cambios técnicos

**1. `src/utils/invoiceHistoryParser.ts`** — Reescribir parser XLSX + ampliar tipos

- Agregar campo `documento` a `ProcessedInvoice` para distinguir tipo (factura, nota crédito, nota débito)
- Nuevo parser `parseLibroDeVentasXLSX(file)` que:
  - Lee la hoja como array de arrays (sin headers)
  - Detecta filas de sección ("FACTURA ELECTRONICA", "NOTA DE CREDITO ELECTRONICA", "NOTA DE DEBITO ELECTRONICA") y asigna el tipo a las filas siguientes
  - Extrae: folio, fecha, razón social, RUT, exento, neto, IVA, total
  - Parsea montos con paréntesis negativos `(X)` → `-X`
  - Ignora filas sin folio numérico y filas de subtotales/totales
  - Retorna `ParsedInvoiceRow[]` con campo `documento` poblado
- Actualizar `parseDate` para soportar DD/MM/YY (año 2 dígitos: ≤50 → 20XX, >50 → 19XX)
- Auto-detectar formato: si raw data contiene "LIBRO DE VENTAS" o "FACTURA ELECTRONICA" en primeras filas → usar nuevo parser; si no → parser columnar existente
- En `processInvoiceRows`: procesar los 3 tipos de documento (no solo facturas). Agregar campo `documentType` al resultado. Las notas de crédito/débito se marcan como tales en el campo `notes`

**2. `src/components/invoices/InvoiceHistoryImport.tsx`** — Ajustes UI

- Importar nuevo parser (auto-detección ya ocurre dentro de `parseXLSXFile`)
- En las estadísticas del preview, mostrar desglose: X facturas, Y notas de crédito, Z notas de débito
- En la tabla de preview, mostrar badge de tipo de documento (Factura / NC / ND)
- Las notas de crédito se insertan con montos negativos en `subtotal`, `vat`, `total`
- Ajustar folio prefix: `HIST-F-{folio}` para facturas, `HIST-NC-{folio}` para NC, `HIST-ND-{folio}` para ND

**3. `src/utils/invoiceHistoryParser.ts`** — Actualizar `ImportPreview`

- Agregar contadores: `creditNoteCount`, `debitNoteCount` al `ImportPreview`
- Agregar `documentType: 'factura' | 'nota_credito' | 'nota_debito'` a `ProcessedInvoice`

### Archivos a modificar
- `src/utils/invoiceHistoryParser.ts` — Parser principal (nuevo parser Libro de Ventas + tipos ampliados)
- `src/components/invoices/InvoiceHistoryImport.tsx` — UI para mostrar tipos de documento y manejar montos negativos

