

# Sub-agrupar por Orden de Compra en TODOS los estados del Pipeline VIP

## Que se hara

Dentro de cada grupo de estado (Cotizados, Con Orden de Compra, Completados, Facturados, etc.), los servicios que tengan orden de compra se agruparan visualmente bajo su numero de O.C. Los servicios sin O.C. aparecen al final del grupo bajo "Sin O.C.".

## Como se vera

```text
v Completados                              $2,500,000 | 15 servicios
  +-------------------------------------------------+
  | OC-10067477              $1,230,000 | 4 servicios |
  |   10797572  Puente Bateria  07/02  $40,000       |
  |   10794877  Grua Livianos   06/02  $1,000,000    |
  +-------------------------------------------------+
  | OC-10067476              $460,000 | 3 servicios   |
  |   10790988  Grua Livianos   02/02  $100,000      |
  +-------------------------------------------------+
  | Sin O.C.                 $810,000 | 8 servicios   |
  |   10785432  Grua Pesados    28/01  $200,000      |
  +-------------------------------------------------+

v Facturados                               $3,100,000 | 20 servicios
  (misma estructura de sub-grupos por O.C.)

v Cotizados                                $500,000 | 5 servicios
  (misma estructura)
```

Cada sub-grupo de O.C. tiene:
- Fila separadora con fondo sutil (`bg-muted/30`)
- Numero de O.C. en azul y bold
- Subtotal y conteo de servicios a la derecha
- Los sub-grupos son colapsables individualmente

## Detalle Tecnico

### Archivo modificado: `src/components/vip/PipelineListView.tsx`

1. **Agregar tipo `POSubGroup`** al inicio del archivo:
   - `poNumber: string` (numero de O.C. o "Sin O.C.")
   - `services: Service[]`
   - `totalValue: number`

2. **Funcion helper `groupByPurchaseOrder`**: Recibe un array de servicios y retorna un array de `POSubGroup[]`, ordenados con las O.C. nombradas primero y "Sin O.C." al final.

3. **Modificar el render dentro de `CollapsibleContent`** (lineas 610-724):
   - En vez de iterar directamente `group.services`, primero calcular los sub-grupos con `groupByPurchaseOrder(group.services)`
   - Si solo hay un sub-grupo (todos sin O.C. o todos con la misma O.C.), renderizar la tabla plana como esta actualmente (sin cambio visual)
   - Si hay multiples sub-grupos, renderizar cada uno con:
     - Una fila de header con `colSpan` completo mostrando el numero de O.C., subtotal y conteo
     - Los servicios del sub-grupo debajo
   - Usar `Collapsible` dentro de cada sub-grupo para poder expandir/contraer

4. **Estado `expandedPOs`**: Un nuevo `useState<Set<string>>` para controlar que sub-grupos de O.C. estan expandidos (por defecto todos abiertos).

