
# Ampliar filtro de estados para incluir servicios cotizados en el importador de OC

## Problema

El filtro actual solo permite servicios `completed` o `with_purchase_order`, pero en el flujo real del Pipeline VIP, la Orden de Compra llega **despues** de cotizar. Servicios en estado `quoted` o `purchase_order_pending` son los principales candidatos para recibir una OC.

En la captura se ve que la patente PFBF-94 fue detectada correctamente, hay 1 servicio "Cotizado" para ese cliente, pero el sistema muestra "Sin match" porque el estado `quoted` esta excluido.

## Solucion

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

Ampliar el filtro de estados candidatos (linea 161-164) para incluir los estados relevantes del pipeline VIP:

```text
Antes:  completed, with_purchase_order
Ahora:  quoted, purchase_order_pending, completed, with_purchase_order
```

Se siguen excluyendo:
- `pending` / `in_progress` (servicio aun no confirmado/cotizado)
- `invoiced` (ya facturado, no deberia reasignarse)
- `cancelled` / `failed`

## Detalle tecnico

Cambiar la linea del filtro a:

```typescript
clientServices = clientServices.filter(s => 
  s.status === 'quoted' || 
  s.status === 'purchase_order_pending' || 
  s.status === 'completed' || 
  s.status === 'with_purchase_order'
);
```

## Archivo a modificar

- `src/hooks/vip/usePurchaseOrderPDFImport.ts` (1 linea)
