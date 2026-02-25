
# Eliminar prefijos duplicados en sub-grupos del Pipeline

## Problema
Los numeros de cotizacion y OC ya vienen con su prefijo incluido en la base de datos (ej: "COT-3915", "OC-470166128"). Al renderizar los sub-grupos, el codigo agrega otro prefijo, resultando en "COT-COT-3915" y "OC-OC-xxx".

## Solucion

### Archivo: `src/components/vip/PipelineListView.tsx`

Cambiar los prefijos en `getSubGroupConfig` a cadena vacia para los casos de cotizacion y OC, ya que los valores almacenados ya incluyen el prefijo:

- Linea 60: `prefix: 'COT-'` cambiar a `prefix: ''`
- Linea 76: `prefix: 'OC-'` cambiar a `prefix: ''`

Esto aplica a los tres casos del switch:
1. `quoted` / `purchase_order_pending`: el `quoteNumber` ya viene como "COT-3915"
2. `invoiced`: ya tiene `prefix: ''` (correcto)
3. Default (OC): el `purchaseOrderNumber` ya viene como "OC-470166128"

Un solo archivo, dos lineas.
