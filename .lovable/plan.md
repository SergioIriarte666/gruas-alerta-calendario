

# Sub-agrupamiento Contextual por Estado en Pipeline VIP

## Que se hara

Cambiar el sub-agrupamiento actual (que siempre agrupa por Orden de Compra) para que sea **inteligente segun el estado**:

| Estado | Agrupar por | Campo | Color del badge |
|---|---|---|---|
| Cotizados | **Cotizacion** | `quoteNumber` | Violeta (`text-violet-600`) |
| Esperando O.C. | **Cotizacion** | `quoteNumber` | Violeta |
| Con Orden de Compra | **Orden de Compra** | `purchaseOrderNumber / purchaseOrder` | Azul (`text-blue-600`) |
| Programados | **Orden de Compra** | `purchaseOrderNumber / purchaseOrder` | Azul |
| En Progreso | **Orden de Compra** | `purchaseOrderNumber / purchaseOrder` | Azul |
| Completados | **Orden de Compra** | `purchaseOrderNumber / purchaseOrder` | Azul |
| Facturados | **N Fiscal (Factura)** | `invoiceNumeroFiscal` | Verde (`text-emerald-600`) |

Los servicios sin el campo correspondiente se agrupan al final bajo "Sin Cotizacion", "Sin O.C." o "Sin Factura" segun el caso.

## Como se vera

```text
v Cotizados                              $500,000 | 5 servicios
  +------------------------------------------------------+
  | COT-2024-001                 $300,000 | 3 servicios   |
  |   10797572  Puente Bateria  07/02  $40,000            |
  |   10794877  Grua Livianos   06/02  $260,000           |
  +------------------------------------------------------+
  | Sin Cotizacion               $200,000 | 2 servicios   |
  +------------------------------------------------------+

v Facturados                             $3,100,000 | 20 servicios
  +------------------------------------------------------+
  | FAC-10051105                 $1,200,000 | 5 servicios  |
  |   ...                                                  |
  +------------------------------------------------------+
  | FAC-10051745                 $800,000 | 4 servicios    |
  |   ...                                                  |
  +------------------------------------------------------+
```

## Detalle Tecnico

### Archivo modificado: `src/components/vip/PipelineListView.tsx`

1. **Renombrar y generalizar `groupByPurchaseOrder`** a una funcion `groupByField` que reciba el campo por el cual agrupar, el label para "sin valor", y el prefijo para mostrar:

```typescript
interface SubGroupConfig {
  fieldExtractor: (s: Service) => string;
  emptyLabel: string;
  prefix: string;
  badgeColor: string;
  badgeBg: string;
}

const getSubGroupConfig = (status: ServiceStatus): SubGroupConfig => {
  switch (status) {
    case 'quoted':
    case 'purchase_order_pending':
      return {
        fieldExtractor: (s) => s.quoteNumber || '',
        emptyLabel: 'Sin Cotización',
        prefix: 'COT-',
        badgeColor: 'text-violet-600',
        badgeBg: 'bg-violet-500/10'
      };
    case 'invoiced':
      return {
        fieldExtractor: (s) => s.invoiceNumeroFiscal || '',
        emptyLabel: 'Sin Factura',
        prefix: '',
        badgeColor: 'text-emerald-600',
        badgeBg: 'bg-emerald-500/10'
      };
    default:
      return {
        fieldExtractor: (s) => s.purchaseOrderNumber || s.purchaseOrder || '',
        emptyLabel: 'Sin O.C.',
        prefix: 'OC-',
        badgeColor: 'text-blue-600',
        badgeBg: 'bg-blue-500/10'
      };
  }
};
```

2. **Modificar `groupByPurchaseOrder`** para aceptar la configuracion:
   - Recibe `services` y `config: SubGroupConfig`
   - Usa `config.fieldExtractor` en vez de hardcodear purchaseOrder
   - Usa `config.emptyLabel` para el grupo sin valor

3. **Actualizar el render de sub-grupos** (lineas 790-825):
   - Usar `config.prefix` + valor en vez de hardcodear `OC-`
   - Usar `config.badgeColor` y `config.badgeBg` para los estilos del badge
   - Usar `config.emptyLabel` en vez de hardcodear "Sin O.C."

4. **Pasar `group.status`** al calcular los sub-grupos para seleccionar la configuracion correcta.

