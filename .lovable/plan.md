

# Plan: Agregar Fecha de Vencimiento en Modal de Conciliación

## Resumen
Mostrar la fecha de vencimiento (`due_date`) de cada factura en el listado del modal "Registrar Pago Inteligente". El dato ya se consulta desde la BD, solo falta mostrarlo.

## Cambio en `src/components/invoices/SmartPaymentForm.tsx`

En la fila de cada factura (líneas ~363-375), agregar la fecha de vencimiento formateada entre el Badge de estado y el monto:

```tsx
// Actual:
<span className="font-medium">{invoice.numero_fiscal || invoice.folio}</span>
<Badge variant={...}>{invoice.status}</Badge>

// Propuesto:
<span className="font-medium">{invoice.numero_fiscal || invoice.folio}</span>
<Badge variant={...}>{invoice.status}</Badge>
<span className="text-xs text-muted-foreground">
  Vence: {format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
</span>
```

Agregar import de `format` de `date-fns` (si no existe ya) y colorear en rojo si está vencida (fecha < hoy).

## Archivos a modificar
- `src/components/invoices/SmartPaymentForm.tsx` — solo JSX, sin cambios de lógica

## Sin riesgo funcional
Solo se agrega un `<span>` visual con datos ya disponibles en el objeto `invoice`.

