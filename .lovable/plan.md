
# Corregir Importador de OC - Agregar matching por referencia de cotizacion

## Problema
La OC PDF tiene la referencia "PRESUPUESTOS 4090" en observaciones, y existen 2 servicios con COT-4090 (valor 80,000 c/u). Pero el sistema no extrae ni usa esta referencia para el matching. Ademas, la OC tiene 1 linea con cantidad 2 x 80,000 = 160,000 total, y el matcher compara 160,000 contra 80,000 (valor individual), sin coincidencia.

## Solucion

### 1. Edge Function: Extraer referencia de presupuesto/cotizacion
**Archivo:** `supabase/functions/parse-purchase-order-pdf/index.ts`

- Agregar campo `quoteReference` al schema de extraccion de la herramienta AI
- Actualizar el prompt para instruir al modelo a buscar referencias como "PRESUPUESTOS XXXX", "COTIZACION XXXX", "COT-XXXX" en observaciones del documento
- Devolver `quoteReference` en la respuesta junto con los items

### 2. Hook: Agregar fallback de matching por referencia de cotizacion
**Archivo:** `src/hooks/vip/usePurchaseOrderPDFImport.ts`

- Agregar `quoteReference` al tipo `ParsedOC`
- Nuevo fallback (prioridad alta, antes de glosa y monto): si la OC tiene `quoteReference`, buscar TODOS los servicios del cliente cuyo `quoteNumber` contenga ese numero (ej: COT-4090 contiene "4090")
- Cuando se encuentran multiples servicios por cotizacion, crear un match por cada uno (no solo uno)
- Mantener intactos todos los fallbacks existentes (patente, OC existente, glosa, monto)

### 3. Matching por monto: considerar precio unitario
**Archivo:** `src/hooks/vip/usePurchaseOrderPDFImport.ts`

- Agregar campo `quantity` opcional al tipo `ParsedOCItem`
- En el fallback de monto, si `item.amount` no coincide y `item.quantity > 1`, tambien probar `item.amount / item.quantity` contra el valor del servicio
- Actualizar el schema de la edge function para incluir `quantity` en cada item

### Flujo resultante para esta OC
1. PDF parseado: OC 4701666694, quoteReference="4090", 1 item sin patente
2. Fallback por quoteReference: busca servicios con COT-4090
3. Encuentra SRV-6387 y SRV-6388 (ambos con COT-4090, valor 80,000)
4. Crea 2 matches (uno por servicio)
5. Usuario revisa y aplica

### Archivos a modificar
1. `supabase/functions/parse-purchase-order-pdf/index.ts` - agregar quoteReference y quantity al schema
2. `src/hooks/vip/usePurchaseOrderPDFImport.ts` - agregar fallback por cotizacion y monto unitario
