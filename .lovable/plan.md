

## Plan: Agregar fecha de pago al modal de detalle de costo

### Problema

El modal de detalle de costo (`ConsolidatedCostDetails.tsx`) muestra Fecha, Monto, Folio y Centro de Costo, pero no muestra la **fecha de pago** (`payment_date`), información importante para el control financiero.

### Solución

Agregar un nuevo bloque visual en la grilla de información del modal, entre Monto y Folio/Centro de Costo, que muestre la fecha de pago cuando existe, con un icono de `CheckCircle` verde (pagado) o `Clock` naranja (pendiente).

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/ConsolidatedCostDetails.tsx` | Agregar bloque de fecha de pago después del bloque de Monto (línea ~114) |

### Detalle

Después del bloque de "Monto" (línea 114), insertar:

```tsx
<div className="flex items-center gap-3">
  <div className={`p-2 rounded-lg ${cost.payment_date 
    ? 'bg-green-100 dark:bg-green-900/30' 
    : 'bg-orange-100 dark:bg-orange-900/30'}`}>
    {cost.payment_date 
      ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
      : <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
  </div>
  <div>
    <p className="text-xs text-muted-foreground">Fecha de Pago</p>
    <p className="font-medium text-foreground">
      {cost.payment_date 
        ? format(new Date(cost.payment_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })
        : 'Pendiente'}
    </p>
  </div>
</div>
```

Se agregarán los imports necesarios (`CheckCircle`, `Clock` de lucide-react).

