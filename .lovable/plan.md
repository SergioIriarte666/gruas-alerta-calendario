## Objetivo
Normalizar a **Title Case (español)** los textos que vienen en MAYÚSCULAS desde el XML del SII al importarlos, para que en Bodega, Proveedores y Costos se vean prolijos y editables. Aplicar **solo a importaciones nuevas** (no migra datos existentes).

## Alcance
- Razón social del proveedor (ej: `COMERCIALIZADORA E IMPORTADORA JAVIER VARAS SPA` → `Comercializadora e Importadora Javier Varas SpA`)
- Nombre/descripción de producto de bodega (ej: `RODAMIENTO 593/572` → `Rodamiento 593/572`)
- Descripción/glosa de costo generada desde el XML (ej: la concatenación `proveedor + items`)

## Qué construir

### 1. Nueva utilidad `src/utils/textNormalization.ts`
Función `toTitleCaseEs(value: string)` que:
- Capitaliza primera letra de cada palabra.
- Mantiene en minúscula palabras chicas (`de, del, la, las, el, los, y, e, o, u, a, en, con, para, por, al`) excepto si son la primera palabra.
- Preserva siglas conocidas con su capitalización oficial: `SpA, S.A., SA, Ltda, Ltda., EIRL, RUT, S.A.C., SCM`.
- Preserva tokens alfanuméricos con números o símbolos (ej: `593/572`, `8MJ-8MP`, `R2-8`, `FJX-FJX`).
- Preserva palabras que ya tienen mayúsculas mezcladas (no las toca).
- Si el texto **no** está mayoritariamente en mayúsculas (ej: viene ya bien escrito en sentence case), lo deja igual — solo normaliza cuando detecta input "shouting" (>70% letras en MAYÚS).

### 2. Aplicar en `src/utils/xmlParser/xmlSupplierParser.ts`
Aplicar `toTitleCaseEs` en estos puntos de extracción (no en `cleanExtractedText` global, para no afectar RUTs/folios):
- Línea ~201 y ~238: `name` del proveedor (Emisor/RznSoc)
- Línea ~480: `razonSocial` antes de armar descripción de costo
- Línea ~490, ~498: `descripcion` y `productName` desde `NmbItem`
- Línea ~535 y ~577: la `description` concatenada (proveedor + items) ya quedará normalizada al usar las variables ya transformadas

### 3. Verificar puntos de inserción aguas abajo
Confirmar que no haya `.toUpperCase()` adicional en:
- `src/components/inventory/XMLInventoryUpload.tsx` (`createMissingProductDirect`, matching) — el `normalize` interno solo se usa para comparar SKU/barcode, no para guardar nombre.
- `src/components/costs/XMLCostUpload.tsx` y `src/components/suppliers/XMLDocumentUpload.tsx` — leen `description`, `product_name`, `supplier.name` tal cual del parser.

### 4. Test rápido manual
Volver a cargar el mismo XML que el usuario adjuntó y verificar que en:
- Bodega → producto se cree como `Rodamiento 593/572`
- Proveedores → razón social como `Comercializadora e Importadora Javier Varas SpA`
- Costos → descripción/glosa en title case

## Lo que NO se hace
- No se migran registros existentes (productos, proveedores ni costos ya cargados).
- No se cambia la lógica de matching (que sigue normalizando con `.toUpperCase()` solo internamente para comparar).
- No se toca el CSV/XLSX importer ni los flujos no-XML.
- No se altera `cleanExtractedText` (sigue usándose para RUT, folios, montos).

## Detalle técnico

```text
toTitleCaseEs("COMERCIALIZADORA E IMPORTADORA JAVIER VARAS SPA")
  → "Comercializadora e Importadora Javier Varas SpA"

toTitleCaseEs("MANGUERA R2-8 TERM. FJX-FJX 90° LT: 2.15 MTS")
  → "Manguera R2-8 Term. FJX-FJX 90° Lt: 2.15 Mts"
  (tokens con guión/número se preservan)

toTitleCaseEs("Rodamiento 593/572")  // ya está bien
  → "Rodamiento 593/572"  (sin cambios, no es shouting)
```

Archivos a tocar:
- **nuevo**: `src/utils/textNormalization.ts`
- **editar**: `src/utils/xmlParser/xmlSupplierParser.ts` (≈6 líneas con wrappers)