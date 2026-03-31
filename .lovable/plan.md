

# Plan: Corregir Importación de PDFs — Enviar Texto en vez de Imagen

## Problema

OpenAI rechaza PDFs enviados como `image_url` con error "Invalid MIME type. Only image types are supported." El gateway anterior de Lovable convertía PDFs a imágenes internamente; la API directa de OpenAI no lo hace.

## Solución

Extraer el texto del PDF en el cliente con `pdfjs-dist` (ya instalado) y enviar texto plano a la Edge Function en lugar del archivo binario.

## Cambios

### 1. Hooks del cliente — extraer texto antes de llamar al servidor

**Archivos:** `src/hooks/vip/useQuotePDFImport.ts`, `src/hooks/vip/usePurchaseOrderPDFImport.ts`

- Usar `pdfjs-dist` para extraer todo el texto del PDF página por página
- Enviar `{ pdfText: textoExtraido }` a la Edge Function en lugar de `{ pdfBase64: ... }`

### 2. Edge Functions — recibir texto en vez de imagen

**Archivos:** `supabase/functions/parse-quote-pdf/index.ts`, `supabase/functions/parse-purchase-order-pdf/index.ts`

- Aceptar parámetro `pdfText` (string) en el body
- Reemplazar el bloque `image_url` por un mensaje de texto plano:
```text
ANTES (roto):
  { type: 'image_url', image_url: { url: 'data:application/pdf;base64,...' } }

DESPUÉS (funciona):
  { type: 'text', text: 'Contenido del PDF:\n\n[texto extraído]' }
```

### 3. Sin cambios en

- `parse-receipt-image` — ya envía imágenes correctamente (JPEG/PNG)
- Prompts de extracción y schemas de herramientas — se mantienen idénticos
- Fallback local con regex — sigue funcionando como respaldo

## Impacto

- Elimina el error de MIME type por completo
- Costo similar (~$0.01–$0.03 por documento con gpt-4o-mini)
- Cero riesgo para otros módulos (costos, comisiones, etc.)

