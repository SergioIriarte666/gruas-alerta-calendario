
# Corregir extraccion de patentes vacias del PDF

## Problema

Los logs de la edge function muestran que la IA extrae correctamente el numero de OC (`4200490558`) pero devuelve la patente vacia (`"patentes":[""]`). Sin patente, el matching contra los servicios falla y muestra "Sin match".

Esto ocurre porque algunos formatos de OC incluyen la patente dentro del texto descriptivo del item (por ejemplo, "Traslado grua VJYG-13 desde...") en lugar de tenerla como campo separado.

## Solucion en dos partes

### 1. Mejorar el prompt de la Edge Function

**Archivo: `supabase/functions/parse-purchase-order-pdf/index.ts`**

Reforzar las instrucciones al modelo para que busque patentes dentro de las descripciones de los items:
- Indicar que la patente puede estar embebida en el texto descriptivo
- Dar ejemplos concretos de como aparecen (ej: "Traslado vehiculo VHZJ75", "Grua patente VJYG-13")
- Incluir formato de patentes chilenas nuevas (2 letras + 4 numeros) y antiguas (4 letras + 2 numeros)

### 2. Agregar fallback de matching por numero de OC

**Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`**

Cuando un item del PDF no tiene patente (string vacio), intentar un match alternativo:
- Buscar servicios del cliente que ya tengan asignada la misma OC (normalizada)
- Si se encuentra, marcarlo como `same_oc`
- Si no se encuentra, buscar servicios sin OC que coincidan por monto (si esta disponible)
- Solo si nada coincide, marcar como `no_match`

Esto cubre el caso donde la OC ya fue asignada previamente y se re-importa el PDF.

## Detalle tecnico

### Edge Function - Prompt mejorado

Agregar al system prompt:
```
- IMPORTANTE: La patente puede aparecer dentro de la descripcion del servicio, 
  no siempre como campo separado. Busca patrones como "XXXX-99", "XXXX99", 
  "XX-9999", "XX9999" dentro del texto de cada item.
- Ejemplos: "Traslado vehiculo VHZJ75", "Grua para patente VJYG-13", 
  "Servicio placa AB1234"
- Si la OC tiene un solo item sin patente visible, revisa todo el texto 
  del documento buscando patentes.
```

### Hook - Fallback de matching

En `processFiles`, despues del loop de matching por patente, agregar logica para items sin patente:

```
Para cada item con patente vacia:
  1. Buscar servicios del cliente con la misma OC (normalizada) -> same_oc
  2. Si no hay match por OC, buscar por monto similar -> matched (con menor confianza)
  3. Si nada coincide -> no_match (pero mostrar el OC number para asignacion manual)
```
