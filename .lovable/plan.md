

## Problema

Los 31 servicios de **Auxilia Club Asistencia S.A.** (y potencialmente otros clientes) aparecen en el Pipeline como "Con Orden de Compra" a pesar de estar facturados (FACT-4328, N° Fiscal 4115). La causa raíz es que el flujo de creación de facturas (`useInvoiceOperations.ts`) actualiza el estado del cierre a `invoiced` pero **nunca actualiza el estado de los servicios asociados** a `invoiced`.

### Datos confirmados
- 31 servicios con `status = 'with_purchase_order'` están vinculados a la factura FACT-4328 vía `invoice_services`
- El cierre CIE-357 ya tiene estado `closed` (debería ser `invoiced`)
- Todos pertenecen a Auxilia Club Asistencia S.A.

## Solución en 2 partes

### 1. Fix del código: Actualizar servicios al crear factura
**Archivo**: `src/hooks/invoices/useInvoiceOperations.ts`

Después de crear la relación `invoice_closures` y actualizar el cierre a `invoiced` (línea ~122), agregar un paso que actualice todos los servicios del cierre a `status = 'invoiced'` y les asigne `invoice_folio` e `invoice_numero_fiscal`:

```typescript
// Actualizar servicios a 'invoiced'
const { error: servicesUpdateError } = await supabase
  .from('services')
  .update({ 
    status: 'invoiced',
    invoice_folio: result.invoice_folio,
    invoice_numero_fiscal: invoiceData.numeroFiscal || null,
    updated_at: new Date().toISOString()
  })
  .in('id', serviceIds);
```

### 2. Fix de datos: Corregir servicios existentes
Ejecutar una corrección masiva que busque **todos** los servicios vinculados a facturas (vía `invoice_services`) cuyo status no sea `invoiced`, y actualizarlos. Esto se hará con una migración SQL vía RPC o directamente en el hook al detectar la inconsistencia.

**Opción**: Crear una función temporal en el código que al cargar el pipeline detecte y corrija automáticamente, o usar el RPC existente `fix_all_invoiced_services_status`.

Dado que ya existe el RPC, lo invocaremos una vez. Además, agregaremos la corrección permanente en `useInvoiceOperations.ts` para que no vuelva a ocurrir.

### Archivos a modificar
- `src/hooks/invoices/useInvoiceOperations.ts` — agregar actualización de servicios a `invoiced` tras crear factura
- Ejecutar corrección de datos con SQL para los servicios actuales

