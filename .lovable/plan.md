

# Plan: Agregar selector de fecha de pago al marcar factura como pagada

## Problema

Al hacer clic en "Marcar como pagada" en una factura, el sistema usa automáticamente la fecha actual (`CURRENT_DATE`) sin dar la opción de elegir otra fecha. Esto es un problema cuando el pago se recibió en una fecha anterior.

## Solución

Agregar un modal de confirmación que incluya un selector de fecha de pago antes de ejecutar la acción, siguiendo los patrones de diseño del módulo de Costos.

## Cambios

### 1. Nuevo componente: Modal de confirmación con fecha
**Archivo: `src/components/invoices/MarkAsPaidModal.tsx`**

Un Dialog que muestra:
- Titulo: "Marcar como Pagada"
- Info de la factura (folio, total)
- DatePickerInput para seleccionar la fecha de pago (por defecto hoy)
- Botones "Cancelar" y "Confirmar Pago"

### 2. Modificar la función SQL para aceptar fecha
**Nueva migración SQL**

Actualizar `create_automatic_payment_for_invoice` para aceptar un parámetro opcional `p_payment_date DATE DEFAULT CURRENT_DATE`. Este parámetro se usará en el `INSERT` del pago y en el `UPDATE` de la factura en lugar de `CURRENT_DATE`.

### 3. Actualizar hook de operaciones
**Archivo: `src/hooks/invoices/useInvoiceOperations.ts`**

Modificar `markAsPaid` para aceptar un segundo parámetro `paymentDate: string` y pasarlo al RPC.

### 4. Actualizar hook principal
**Archivo: `src/hooks/useInvoices.ts`**

Propagar el parámetro `paymentDate` en el wrapper de `markAsPaid`.

### 5. Integrar modal en las vistas
**Archivos:**
- `src/pages/Invoices.tsx` - estado para controlar el modal, pasar fecha al `markAsPaid`
- `src/components/invoices/InvoicesTable.tsx` - abrir modal en vez de llamar directamente
- `src/components/invoices/InvoicesPipelineView.tsx` - mismo cambio

El botón de "marcar como pagada" abrirá el modal en lugar de ejecutar la acción directamente. Para acciones batch, se usará un solo modal con la fecha aplicada a todas las facturas seleccionadas.

## Detalle Técnico

### Migración SQL
```sql
DROP FUNCTION IF EXISTS public.create_automatic_payment_for_invoice(uuid);

CREATE OR REPLACE FUNCTION public.create_automatic_payment_for_invoice(
  p_invoice_id uuid,
  p_payment_date date DEFAULT CURRENT_DATE
) RETURNS jsonb AS $$ ...
-- Usar p_payment_date en lugar de CURRENT_DATE en INSERT y UPDATE
```

### Llamada RPC actualizada
```typescript
await supabase.rpc('create_automatic_payment_for_invoice', {
  p_invoice_id: id,
  p_payment_date: paymentDate // formato 'YYYY-MM-DD'
});
```

### Flujo del modal
1. Usuario hace clic en el icono de check (marcar pagada)
2. Se abre modal con DatePickerInput (fecha default: hoy)
3. Usuario puede cambiar la fecha o dejar la actual
4. Al confirmar, se ejecuta `markAsPaid(id, fecha)`
5. Modal se cierra y la tabla se refresca

