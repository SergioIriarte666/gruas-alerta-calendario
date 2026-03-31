
Objetivo: restaurar la carga de Cotizaciones y OCs en Pipeline VIP corrigiendo el fallo real del backend y alineando la UX con el módulo de Costos.

Qué encontré
- El error no está en el matching del Pipeline VIP ni en la UI principal.
- Ambos importadores llaman Edge Functions:
  - `src/hooks/vip/useQuotePDFImport.ts` → `parse-quote-pdf`
  - `src/hooks/vip/usePurchaseOrderPDFImport.ts` → `parse-purchase-order-pdf`
- La evidencia disponible confirma que `parse-quote-pdf` está fallando en el gateway de IA con:
  - `401 Invalid API key format. Key must start with 'sk_' prefix`
- `parse-purchase-order-pdf` tiene la misma implementación insegura/pasada de fecha que `parse-quote-pdf`, así que debe corregirse igual.
- Ya existe un patrón corregido en `supabase/functions/parse-receipt-image/index.ts`: usa `AI_GATEWAY_KEY || LOVABLE_API_KEY` y devuelve errores más claros.

Plan de implementación

1. Unificar la autenticación del gateway de IA en ambas Edge Functions
- Actualizar `supabase/functions/parse-quote-pdf/index.ts`
- Actualizar `supabase/functions/parse-purchase-order-pdf/index.ts`
- Cambiar la lectura de credenciales a:
  - priorizar `AI_GATEWAY_KEY`
  - fallback a `LOVABLE_API_KEY`
- Mantener validación JWT y CORS existentes.

2. Mejorar el manejo de errores del gateway
- Replicar el enfoque de `parse-receipt-image`:
  - helper para respuestas JSON consistentes
  - parseo del body de error del gateway
  - mensajes específicos para `401`, `402`, `429`
- Evitar el error genérico actual `AI gateway error: 401` que hoy termina como 500 opaco.
- Resultado esperado:
  - si el secreto sigue malo, el usuario verá un mensaje claro y no un fallo ambiguo.
  - si `AI_GATEWAY_KEY` ya está disponible/correcto, la importación vuelve a funcionar sin depender del secreto viejo.

3. Mantener intacta la lógica VIP de matching
- No tocar la lógica de emparejamiento de servicios salvo que aparezca un segundo problema tras restaurar el parseo.
- Conservar:
  - validación por RUT
  - fuzzy matching VIN
  - expansión de múltiples patentes
  - estados `matched / same_* / already_has_* / no_match`

4. Mejorar la UX de error en los importadores, siguiendo el estilo del módulo de Costos
- Ajustar `src/components/vip/QuotePDFImporter.tsx`
- Ajustar `src/components/vip/PurchaseOrderPDFImporter.tsx`
- Reemplazar el error final simple por un bloque más visible y consistente con patrones del módulo Costos:
  - mensaje principal claro
  - detalle accionable cuando venga desde la Edge Function
- Mantener tipografía, badges, espaciado y tono visual del módulo de Costos.

5. Validación final
- Verificar el flujo completo de:
  - importar cotización PDF
  - importar OC PDF
- Confirmar que:
  - ya no aparece `Edge Function returned a non-2xx status code`
  - los PDFs pasan a preview cuando el secreto válido está disponible
  - los errores visibles sean entendibles si el gateway vuelve a fallar

Archivos a intervenir
- `supabase/functions/parse-quote-pdf/index.ts`
- `supabase/functions/parse-purchase-order-pdf/index.ts`
- `src/components/vip/QuotePDFImporter.tsx`
- `src/components/vip/PurchaseOrderPDFImporter.tsx`

Notas técnicas
- La causa principal es de infraestructura/configuración de secreto consumida por estas dos functions, no del Pipeline VIP en sí.
- La corrección más segura es reutilizar el estándar ya aplicado en `parse-receipt-image`, en vez de inventar otra ruta.
- Si después de esto persistiera un bloqueo, el siguiente punto a revisar sería el secreto real disponible en runtime (`AI_GATEWAY_KEY` vs `LOVABLE_API_KEY`), pero primero hay que dejar ambas functions preparadas para usar la ruta correcta.
