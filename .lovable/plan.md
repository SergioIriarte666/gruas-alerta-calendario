

## Plan: N° Fiscal como campo principal de búsqueda + indicador de tipo de documento

### Contexto
- **Ventas**: El folio usa prefijos `HIST-F-`, `HIST-NC-`, `HIST-ND-` para indicar tipo de documento. El `numeroFiscal` es el número real del SII.
- **Compras**: El campo `invoice_number` es el número de factura del proveedor. No tiene un campo separado de tipo de documento.
- El buscador principal ya busca por `numeroFiscal` en ventas, pero en compras solo busca por `invoice_number`.

### Cambios

#### 1. Histórico de Ventas — Tabla (`HistoricalSalesTable.tsx`)
- En la columna "N° Fiscal", agregar un badge con el tipo de documento derivado del folio:
  - `HIST-F-` o sin prefijo HIST → **FE** (Factura Electrónica) — badge gris
  - `HIST-NC-` → **NC** (Nota de Crédito) — badge amarillo
  - `HIST-ND-` → **ND** (Nota de Débito) — badge naranja
- Formato: `[FE] 4115` o `[NC] 4115`

#### 2. Histórico de Ventas — Búsqueda (`HistoricalSales.tsx`)
- Priorizar `numeroFiscal` en la búsqueda: si el usuario escribe un número, buscar primero en `numeroFiscal`, luego en `folio`, luego en nombre de cliente.
- Ya funciona así, solo ajustar el placeholder para enfatizar N° Fiscal.

#### 3. Histórico de Compras — Tabla (`HistoricalPurchasesTable.tsx`)
- Renombrar columna "N° Factura" a "N° Fiscal".
- Agregar badge de tipo de documento basado en el campo `description` o un nuevo campo. Como las compras no tienen prefijo de tipo, derivar del `invoice_number`:
  - Si empieza con `NC-` → **NC**
  - Si empieza con `ND-` → **ND**
  - Default → **FE**

#### 4. Histórico de Compras — Búsqueda (`HistoricalPurchasesFilters.tsx`)
- Renombrar label "N° Factura" a "N° Fiscal" y actualizar placeholder.

#### 5. Búsqueda general en ambos — Priorización
- En la lógica de filtrado de ventas, el `searchTerm` ya busca en `numeroFiscal`. Solo asegurar que el orden de prioridad sea: `numeroFiscal` > `folio` > `client.name`.
- En compras, el filtro `invoiceNumber` ya busca en `invoice_number` que es el número fiscal del proveedor.

### Archivos a modificar
- `src/components/finance/historical/HistoricalSalesTable.tsx` — badge tipo documento (FE/NC/ND)
- `src/components/finance/historical/HistoricalPurchasesTable.tsx` — renombrar columna + badge tipo documento
- `src/components/finance/historical/HistoricalPurchasesFilters.tsx` — renombrar label/placeholder
- `src/components/finance/historical/HistoricalSalesFilters.tsx` — ajustar placeholder para enfatizar N° Fiscal

