
# Plan: Importador de Cotizaciones desde PDF

## Objetivo
Agregar un importador de PDFs de cotizaciones en la pestana O.C. (junto al importador de OC existente), que extraiga numero de cotizacion, items con patentes y montos, y los asocie automaticamente a los servicios del cliente.

## Formato de Cotizacion (basado en el modelo proporcionado)
- **Numero**: "N 4120" en la esquina superior derecha
- **Fecha**: "26-02-2026"
- **Items**: tabla con Codigo, Descripcion (incluye patentes), Cantidad, Precio Unitario, Valor
- **Patentes dentro de la descripcion**: "Remolque de Vehiculos Toyota Hilux TKFK-99 Norte a Franklin"
- **Totales**: Neto, IVA, Total

## Cambios

### 1. Edge Function: `parse-quote-pdf`
**Archivo nuevo:** `supabase/functions/parse-quote-pdf/index.ts`
- Misma estructura que `parse-purchase-order-pdf` pero con prompt adaptado para cotizaciones
- Extrae: `quoteNumber`, `date`, `items[]` (patente, detail, amount, quantity), `totals`
- Usa la misma llamada a Lovable AI Gateway con Gemini
- Tool call `extract_quote` con schema adaptado

### 2. Hook: `useQuotePDFImport`
**Archivo nuevo:** `src/hooks/vip/useQuotePDFImport.ts`
- Basado en `usePurchaseOrderPDFImport.ts` con las siguientes diferencias:
  - Llama a `parse-quote-pdf` en vez de `parse-purchase-order-pdf`
  - Filtra servicios candidatos: `completed` o `quoted` (sin cotizacion asignada)
  - Al aplicar, actualiza `quoteNumber` y cambia status a `quoted`
  - Matching por patente (principal), luego por monto como fallback

### 3. Componente: `QuotePDFImporter`
**Archivo nuevo:** `src/components/vip/QuotePDFImporter.tsx`
- Misma estructura visual que `PurchaseOrderPDFImporter`
- Titulo: "Importar Cotizacion desde PDF"
- Tabla de preview muestra: Patente, Servicio, Cotizacion Actual, N Cotizacion Nueva, Estado
- Badges: coincidencias, ya asignada, sin match
- Boton "Aplicar X Cotizaciones"

### 4. Integrar en la pagina VipClientPipeline
**Archivo:** `src/pages/VipClientPipeline.tsx`
- Agregar `QuotePDFImporter` en la pestana `purchase-orders`, ANTES del `PurchaseOrderPDFImporter`
- Ambos importadores coexisten en la misma pestana

## Flujo del usuario
1. Sube un PDF de cotizacion en el dropzone
2. La IA extrae numero de cotizacion, patentes, montos
3. El sistema busca servicios del cliente que coincidan por patente
4. Muestra tabla de preview con matches encontrados
5. El usuario selecciona cuales aplicar y confirma
6. Se actualiza `quote_number` y status a `quoted` en cada servicio

## Detalle tecnico

### Edge Function - Prompt de extraccion
El prompt sera similar al de OC pero enfocado en cotizaciones chilenas:
- Numero de cotizacion aparece como "N", "Cotizacion N", "Presupuesto N"
- Patentes estan DENTRO de la descripcion de cada item (mismo patron que OC)
- Montos en CLP

### Matching - misma logica jerarquica
1. **Patente**: coincidencia exacta normalizada
2. **Monto**: fallback si no hay patente
3. Servicios candidatos: status `completed` o `purchase_order_pending` (sin cotizacion)

## Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `supabase/functions/parse-quote-pdf/index.ts` | Crear - Edge function para parsear cotizaciones |
| `src/hooks/vip/useQuotePDFImport.ts` | Crear - Hook de importacion de cotizaciones |
| `src/components/vip/QuotePDFImporter.tsx` | Crear - Componente UI del importador |
| `src/pages/VipClientPipeline.tsx` | Modificar - Agregar QuotePDFImporter en pestana O.C. |
