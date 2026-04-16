

# Plan: Importar Facturas de Proveedor desde PDF (sin romper XML)

## Problema
Algunos proveedores no entregan XML (DTE), solo entregan el PDF de la factura. Actualmente no hay forma de importar esos datos sin ingresarlos manualmente.

## Solución propuesta

Agregar un botón **"Importar PDF"** junto al botón existente de "Importar XML" en el módulo de **Costos**. El flujo reutiliza la Edge Function `parse-receipt-image` que ya existe y funciona con OpenAI Vision (gpt-4o-mini), adaptándola para aceptar también PDFs.

### Flujo del usuario
1. Clic en "Importar PDF" → se abre un modal (estilo wizard, igual que el XML)
2. Arrastra/sube el PDF de la factura
3. El sistema convierte la primera página a imagen, la envía a `parse-receipt-image`
4. Muestra los datos extraídos (proveedor, RUT, folio, fecha, montos) en un formulario editable para que el usuario corrija lo que haga falta
5. El usuario asigna categoría/subcategoría y confirma
6. Se crea el costo + pago a proveedor + factura (misma lógica triangular que el XML)

### Cambios técnicos

**1. Edge Function `parse-receipt-image` (mínima adaptación)**
- Ya acepta `imageBase64` + `imageMimeType` → solo hay que ampliar el prompt del sistema para que también reconozca facturas completas (no solo boletas de gasto)
- Agregar campo `items` (lista de ítems con descripción, cantidad, monto) al schema de extracción para facturas con múltiples líneas

**2. Nuevo componente `PDFCostImport.tsx`**
- Modal con dropzone para PDF (acepta `.pdf`)
- Usa `pdfjs-dist` (ya instalado en el proyecto para VIP pipeline) para renderizar la primera página como imagen
- Envía la imagen a `parse-receipt-image` vía `supabase.functions.invoke`
- Muestra formulario de revisión con los datos extraídos (editable)
- Reutiliza los mismos hooks: `useAddCost`, `useCostCategories`, `useCostSubcategories`, `usePaymentTerms`, `useCostDuplicateCheck`
- Aplica la misma sincronización triangular (costo → pago proveedor → factura) que el XML

**3. Página de Costos (`Costs.tsx`)**
- Agregar botón "Importar PDF" junto al botón "Importar XML" existente
- Abre `PDFCostImport`

**4. Opcionalmente: Módulo de Proveedores**
- Agregar el mismo botón en la pestaña de documentos del proveedor para importar facturas PDF directamente asociadas a ese proveedor

### Lo que NO se toca
- El importador XML existente no se modifica en absoluto
- La sincronización triangular existente no cambia (se reutiliza)
- Los triggers de BD permanecen intactos
- La lógica de detección de duplicados se reutiliza (mismo `useCostDuplicateCheck`)

### Archivos involucrados
- `supabase/functions/parse-receipt-image/index.ts` (~20 líneas: ampliar prompt + agregar `items` al schema)
- Nuevo: `src/components/costs/PDFCostImport.tsx` (~400-500 líneas: modal wizard)
- `src/pages/Costs.tsx` (~5 líneas: botón + import)
- Nuevo: `src/hooks/costs/usePDFCostExtraction.ts` (~100 líneas: lógica de conversión PDF→imagen→AI)

### Resultado
El usuario puede importar facturas PDF con extracción automática vía IA, revisar y corregir los datos, y crear el costo con toda la trazabilidad (proveedor, pago, factura) igual que si hubiera importado un XML.

