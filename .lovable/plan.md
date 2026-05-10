
## Diagnóstico (con los 3 PDFs reales de SalfaRent)

Hoy fallan **dos cosas independientes**:

### A) Extracción del PDF (edge function `parse-purchase-order-pdf`)
- No detecta patentes cortas / VIN cortos como `STVK15` (las trata como ruido y devuelve `""`).
- No extrae `PRESUPUESTO 4142` desde la línea "Observación" (el prompt sólo busca cotizaciones).
- Devuelve un `detail` genérico ("Remolque de Vehículos") en lugar del literal de la tabla ("TRASLADO DE UNIDADES", "TRASLADO DE INSUMOS A FAENA 09-03-26").
- No detecta fechas embebidas en la glosa ("...A FAENA **09-03-26**"), que suelen ser la fecha real del servicio.

### B) Matching (`usePurchaseOrderPDFImport.ts`)
- Es una cascada rígida (primer match gana), no un score combinando criterios.
- Nunca usa la **fecha** del documento ni la fecha embebida en la glosa para discriminar.
- Trata "presupuesto" como sinónimo de "cotización", y lo ignora si la patente está presente.
- Cuando no hay match, no muestra candidatos ni motivo, así que no se puede corregir manualmente.

## Cambios

### 1. Edge function `parse-purchase-order-pdf`

- Ampliar el schema de la tool de OpenAI:
  - `budgetReference: string` (nuevo, separado de `quoteReference`).
  - `serviceDate: string | null` (fecha del servicio si aparece embebida en el detalle, formato `YYYY-MM-DD`).
- Reforzar el system prompt:
  - Patentes / códigos de vehículo: aceptar **6+ caracteres alfanuméricos** (no solo formato chileno y no solo VIN 16-17). Incluir explícitamente ejemplos como `STVK15`.
  - Mantener el `detail` literal de la tabla (no resumir). Repetir "NO PARAFRASEAR".
  - Buscar en "Observación / Notas / Glosa" patrones `PRESUPUESTO N°? XXXX`, `PPTO XXXX`, `PRES. XXXX` → `budgetReference`.
  - Buscar fechas dentro del detail con regex `DD-MM-YY[YY]` o `DD/MM/YY[YY]` → `serviceDate`.
- Fallback local en `localVipPdfParser.ts`: mismas regex de presupuesto y fecha-en-glosa, y aflojar el regex de patente a `[A-Z0-9]{6,8}`.

### 2. Hook `usePurchaseOrderPDFImport.ts` — motor de scoring

Reemplazar la cascada por un **score por candidato**. Para cada ítem, recorrer los servicios elegibles del cliente y sumar:

| Criterio | Puntos |
|---|---|
| Patente normalizada exacta | 100 |
| Patente fuzzy (Levenshtein ≤ 1 corto, ≤ 2 VIN) | 60 |
| Mismo nº de cotización (`service.quoteNumber`) | 50 |
| Mismo nº de presupuesto (campo nuevo `budgetReference` ↔ `service.quoteNumber`) | 50 |
| Monto exacto (`item.amount` = `service.value` o = unitario) | 30 |
| Monto ±2% | 15 |
| Fecha (servicio dentro de ±30 días de la fecha de OC o `serviceDate` del ítem) | 20 |
| Fecha exacta | +10 |
| Glosa OC ↔ tipo de servicio (token-includes en ambos sentidos) | 15 |
| Servicio ya tiene OC distinta a la actual | -1000 (descartado) |

Reglas:
- Gana el de mayor score, **mínimo 50 pts**.
- Empate → fecha de servicio más cercana a la fecha de la OC.
- Mantener `usedServiceIds` para no duplicar.
- Estados elegibles iguales (`quoted`, `purchase_order_pending`, `completed`, `with_purchase_order`, `invoiced`).

### 3. UI `PurchaseOrderPDFImporter.tsx` — diagnóstico visible

- Badge en cada fila con el **motivo del match** (ej. "Presupuesto 4142 + Monto + Fecha").
- En filas `no_match`: popover con los **3 mejores candidatos** y su score, para ver por qué no calzó (selección manual queda fuera de alcance de este plan; primero validamos que el matching automático mejora).
- Toast de resumen al final ya existe; agregar contador de "matched por presupuesto".

### 4. Verificación

Probar con los 3 PDFs subidos: deberían producir
- `4701708396` → match por **PRESUPUESTO 4142** + monto + fecha.
- `4701708476` → match por **fecha embebida 09-03-26** + monto + glosa "TRASLADO DE INSUMOS".
- `4701708483` → match por **patente STVK15** (con extractor reforzado).

## Archivos afectados

- `supabase/functions/parse-purchase-order-pdf/index.ts` — schema + prompt + sanitización.
- `src/utils/localVipPdfParser.ts` — regex de patente, presupuesto, fecha-en-glosa.
- `src/hooks/vip/usePurchaseOrderPDFImport.ts` — motor de scoring + razón del match.
- `src/components/vip/PurchaseOrderPDFImporter.tsx` — badge de motivo + popover de candidatos.

## Fuera de alcance

- No se agregan columnas a la BD (presupuesto se reusa como `quote_number` en la práctica del cliente).
- No se cambia el importador de Cotizaciones ni el de Facturas (ese era el otro hilo).
- Selección manual de servicios para ítems sin match queda para una segunda iteración.
