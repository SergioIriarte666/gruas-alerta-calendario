

# Fix: Mejorar lectura completa de documentos PDF (OC y Cotizaciones)

## Problema
El lector de PDFs no esta detectando referencias a cotizaciones que aparecen en secciones de "Observaciones" o "Notas" del documento. En el ejemplo, la OC dice "TRASLADO UNIDAD PLV SEGUN COTIZACION 4100" pero el sistema no extrae "4100" como referencia de cotizacion.

## Causa
El prompt del usuario enviado a la IA solo dice "Extrae numero de OC, fecha, items y totales" sin mencionar buscar referencias. Aunque el prompt de sistema lo indica, la IA prioriza lo que el usuario pide. Ademas, las instrucciones del sistema no son suficientemente enfaticas sobre leer TODAS las secciones del documento.

## Solucion

### Archivo: `supabase/functions/parse-purchase-order-pdf/index.ts`

1. **Reforzar el prompt de sistema** con instrucciones mas explicitas:
   - Agregar enfasis en leer TODO el documento: encabezados, items, observaciones, notas, pie de pagina
   - Agregar mas variantes de texto para detectar referencias: "SEGUN COTIZACION", "COTIZACIÓN", "REF", "PPTO"
   - Indicar que la referencia puede aparecer en CUALQUIER parte del documento, no solo en observaciones

2. **Modificar el mensaje del usuario** para incluir explicitamente la busqueda de referencias:
   - Cambiar de: "Extrae numero de OC, fecha, items y totales"
   - A: "Extrae todos los datos incluyendo numero de OC, fecha, items, totales, Y cualquier referencia a cotizaciones o presupuestos en observaciones, notas o glosas"

### Archivo: `supabase/functions/parse-quote-pdf/index.ts`

Aplicar mejoras similares al lector de cotizaciones:
1. Reforzar instrucciones para leer el documento completo
2. Mejorar el mensaje del usuario para ser mas explicito

### Cambios especificos en el prompt de sistema (OC)

Agregar/reforzar estas lineas:
- "LEE EL DOCUMENTO COMPLETO: encabezado, tabla de items, observaciones, notas al pie, glosas y cualquier otro texto visible."
- "Para quoteReference: busca en TODO el documento frases como 'SEGUN COTIZACION', 'COTIZACIÓN N', 'PRESUPUESTO', 'COT-', 'PPTO', 'REF COTIZACION', seguidas de un numero."
- "La referencia a cotizacion puede estar en la seccion de Observaciones, Notas, Glosa, descripcion del item, o cualquier parte."
- "NUNCA devuelvas quoteReference vacio si hay una referencia a cotizacion o presupuesto en el documento."

### Cambio en el mensaje del usuario (OC)

```
'Extrae todos los datos de esta Orden de Compra: numero de OC, fecha, lista de items con patente/detalle/monto, totales, Y MUY IMPORTANTE busca en TODO el documento (especialmente observaciones, notas y glosas) cualquier referencia a cotizaciones o presupuestos.'
```

### Despliegue

Ambas edge functions deben ser re-desplegadas despues de los cambios.

