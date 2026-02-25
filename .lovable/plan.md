

# Correccion del Flujo VIP Pipeline

## Problema

El flujo real del negocio VIP es **post-servicio**: primero se realiza el trabajo, despues se factura administrativamente:

```text
Completado -> Cotizado -> Con O.C. -> Facturado
```

Pero el pipeline actual esta ordenado como un flujo **pre-servicio** (cotizar antes de ejecutar), lo que causa que servicios completados con cotizacion aparezcan en la seccion "Completados" en vez de moverse a "Cotizados".

### Causas raiz encontradas:

1. **Orden del pipeline incorrecto**: `PIPELINE_STATUSES` en `PipelineListView.tsx` lista los estados en orden pre-servicio (quoted primero, completed casi al final).

2. **Transiciones invertidas**: `ServiceStatusTransition.tsx` define `quoted -> purchase_order_pending -> pending -> in_progress -> completed -> invoiced`, pero el flujo real es `completed -> quoted -> with_purchase_order -> invoiced`.

3. **Sin cambio automatico de estado**: Cuando se asigna un numero de cotizacion a un servicio completado (individualmente, no batch), el status **no cambia** automaticamente a `quoted`. Solo el BatchUpdateModal tiene logica de `auto_update_status`.

## Solucion

### 1. Reordenar `PIPELINE_STATUSES` en `PipelineListView.tsx`

Cambiar el orden para reflejar el flujo real post-servicio:

```text
Antes:  quoted -> purchase_order_pending -> with_purchase_order -> pending -> in_progress -> completed -> failed -> invoiced
Despues: pending -> in_progress -> completed -> failed -> quoted -> purchase_order_pending -> with_purchase_order -> invoiced
```

Los estados operativos (pending, in_progress, completed, failed) van primero, seguidos de los estados administrativos/facturacion (quoted, with_purchase_order, invoiced). Se elimina `purchase_order_pending` como estado separado ya que es redundante con el flujo real.

### 2. Corregir transiciones en `ServiceStatusTransition.tsx`

Actualizar el mapa de transiciones para reflejar el flujo post-servicio:

| Estado actual | Siguiente estado |
|---|---|
| `completed` | `quoted` |
| `quoted` | `purchase_order_pending` (solicitar OC) |
| `purchase_order_pending` | `with_purchase_order` (confirmar OC) |
| `with_purchase_order` | `invoiced` |
| `failed` | `invoiced` |

Agregar configuracion visual para `with_purchase_order` que actualmente falta en el componente.

### 3. Auto-cambiar status al asignar cotizacion/OC individualmente

En `useServiceManager.ts`, dentro de la actualizacion parcial: si se asigna un `quote_number` a un servicio en estado `completed`, cambiar automaticamente el status a `quoted`. Si se asigna `purchase_order_number` a un servicio en estado `quoted` o `purchase_order_pending`, cambiar a `with_purchase_order`.

### 4. Actualizar etiquetas de transicion

Ajustar las etiquetas de los botones de transicion para que reflejen el flujo real:

- Completado: "Agregar Cotizacion"
- Cotizado: "Solicitar O.C."
- Esperando O.C.: "Confirmar O.C."
- Con O.C.: "Facturar"

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/vip/PipelineListView.tsx` | Reordenar `PIPELINE_STATUSES` al flujo post-servicio |
| `src/components/vip/ServiceStatusTransition.tsx` | Corregir mapa de transiciones y agregar `with_purchase_order` |
| `src/hooks/services/useServiceManager.ts` | Auto-cambiar status al asignar quote/OC en update parcial |

## Resultado esperado

- Los servicios completados apareceran en "Completados" hasta que reciban cotizacion
- Al asignar cotizacion, se moveran automaticamente a "Cotizados"
- Al asignar O.C., se moveran a "Con O.C."
- El pipeline mostrara el flujo en el orden correcto del negocio

