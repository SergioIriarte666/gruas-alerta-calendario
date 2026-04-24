## Problema

Las facturas anuladas con Nota de Crédito siguen apareciendo como "no pagadas" en métricas, dashboards y exportaciones, aunque en la tabla de facturas su estado se muestra correctamente como **Anulada**.

## Causa raíz

Cuando se anula una factura (`useInvoiceCancellation.ts`), solo se cambia `status = 'cancelled'`, pero los campos financieros `paid_amount` y `remaining_amount` se dejan intactos. Verificado en BD:

```
FACT-4068  cancelled  total 166.600  paid 0  remaining 166.600
FACT-4290  cancelled  total 714.000  paid 0  remaining 714.000
```

Varios cálculos de "pendiente" suman por `remaining_amount` o por `total - paid_amount` sin filtrar `cancelled`, por lo que cuentan estos montos como deuda.

Lugares afectados detectados:
- `src/hooks/useClientsDashboardMetrics.ts` → `fetchPendingInvoices` ya filtra por estados, pero NO incluye exclusión explícita y otros sitios sí cuentan canceladas.
- `src/hooks/useClientInvoices.ts` → `pendingAmount = totalInvoiced - totalPaid` (no excluye anuladas del `totalInvoiced`).
- `src/components/invoices/InvoiceExportModal.tsx` → mismo cálculo `pendingAmount = totalInvoiced - totalPaid`.
- Cualquier vista que muestre `remainingAmount` de una factura anulada lo verá > 0.

## Solución

### 1. Normalizar la factura al anularla (fuente de verdad)
En `src/hooks/invoices/useInvoiceCancellation.ts`, cuando se marca como `cancelled`, también poner:
- `paid_amount = total`
- `remaining_amount = 0`
- `payment_date = cancelled_at` (opcional, para trazabilidad)

Esto resuelve el 95% de los casos automáticamente, sin tocar cada vista.

### 2. Migración para corregir las facturas ya anuladas
Ejecutar un UPDATE one-shot:
```sql
UPDATE invoices
SET paid_amount = total, remaining_amount = 0
WHERE status = 'cancelled' AND remaining_amount <> 0;
```

### 3. Defensa en cálculos agregados
Ajustar los cálculos que recorren todas las facturas para excluir explícitamente `cancelled`:
- `src/hooks/useClientInvoices.ts`: excluir anuladas de `totalInvoiced` y `pendingAmount`.
- `src/components/invoices/InvoiceExportModal.tsx`: idem.
- `src/hooks/useClientsDashboardMetrics.ts`: añadir `.neq('status', 'cancelled')` por seguridad.

### 4. UI del detalle de factura anulada
En `InvoiceDetailsModal` y tarjetas, mostrar "Anulada con NC {número}" en lugar de saldo pendiente cuando `status === 'cancelled'`.

## Resultado esperado
- Facturas anuladas dejan de contar como deuda en dashboards, métricas de cliente y exportaciones.
- El historial y el badge "Anulada" se mantienen.
- Los servicios siguen liberándose para re-facturación (comportamiento actual ya correcto).
