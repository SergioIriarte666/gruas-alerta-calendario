
# Rediseño del Modal de Detalles de Factura

## Problema Actual
El modal de detalles de factura muestra muy poca informacion: solo cliente, fecha de vencimiento, totales basicos y estado. Faltan campos importantes como numero fiscal, fecha de emision, desglose subtotal/IVA, cierre asociado, condicion de pago, y el historial de pagos aplicados.

## Solucion
Redisenar el `InvoiceDetailsModal` siguiendo el patron de diseno del `CostDetailsModal` (tabs, secciones con iconos, componentes `DetailItem`/`DetailSection`), agregando toda la informacion disponible de la factura.

## Informacion que se agregara

**Tab 1 - Informacion General:**
- Folio y Numero Fiscal
- Cliente (nombre, RUT, email, telefono)
- Fecha de Emision y Fecha de Vencimiento
- Condicion de pago (si existe)
- Estado con badge visual
- Notas

**Tab 2 - Informacion Financiera:**
- Subtotal
- IVA
- Total
- Monto Pagado
- Monto Pendiente
- Fecha de Pago (si aplica)
- Barra de progreso visual del pago

**Tab 3 - Pagos Aplicados:**
- Historial de pagos aplicados a la factura usando `usePaymentApplications`
- Folio de factura, monto aplicado, metodo, fecha

## Cambios Tecnicos

### 1. `src/components/invoices/InvoiceDetailsModal.tsx`
- Reescribir completamente usando el patron de `CostDetailsModal`
- Agregar componentes `DetailItem` y `DetailSection` reutilizables
- Implementar 3 tabs: "General", "Financiera", "Pagos"
- Ampliar el modal a `max-w-4xl` con scroll vertical
- Usar `usePaymentApplications` para cargar historial de pagos en la tab 3
- Agregar barra de progreso visual para el porcentaje pagado
- Mostrar condicion de pago si `paymentTermId` existe (fetch del nombre)
- Footer consistente con "Creado por" y "Actualizado"

### 2. `src/components/invoices/InvoicesTable.tsx`
- Pasar la factura con detalles completos (`getInvoiceWithDetails`) al modal en vez de la factura basica

### 3. `src/components/invoices/InvoicesMobileView.tsx`
- Mismo ajuste: pasar factura con detalles al modal
