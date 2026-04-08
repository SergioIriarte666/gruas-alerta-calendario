

# Plan: Destacar Costos con Fecha de Pago Futura

## Resumen
Agregar un indicador visual en la tabla de costos para distinguir los pagos programados a futuro (donde `payment_date` es posterior a hoy) de los ya pagados o pendientes.

## Cambios

### Modificar `src/components/costs/EnhancedCostsTable.tsx`
- En la columna de estado de pago (líneas ~318-332), agregar una tercera variante: cuando `payment_date` existe pero es futura, mostrar un icono `CalendarClock` en color **amber/naranja** con tooltip "Pago programado - DD/MM/YYYY".
- El icono verde (`CheckCircle`) se mantiene para pagos con fecha pasada o de hoy.
- El círculo gris se mantiene para costos sin `payment_date`.
- Opcionalmente, agregar un leve fondo amber a la fila completa (`bg-amber-50/50 dark:bg-amber-900/10`) para que sea más visible.

### Modificar `src/components/costs/CostsTable.tsx`
- Aplicar la misma lógica en la tabla compacta (líneas ~98-108).

### Lógica de comparación
```ts
const isFuturePayment = cost.payment_date && new Date(cost.payment_date + 'T00:00:00') > new Date();
```

## Resultado visual
- **Verde ✓**: Pagado (fecha de pago ≤ hoy)
- **Amber 📅**: Pago programado a futuro (fecha de pago > hoy)  
- **Gris ○**: Pendiente (sin fecha de pago)

