

# Plan: Agregar estado "Con Orden de Compra" al historial de servicios

## Problema
El componente `VehicleHistory.tsx` (pestaña "Historial" del modal de servicio) tiene un mapa de estados incompleto. Le falta el estado `with_purchase_order`, por lo que los servicios con OC se muestran como "Desconocido".

## Cambio
En `src/components/services/VehicleHistory.tsx`, línea 30, agregar el estado faltante al `statusConfig`:

```
with_purchase_order: { label: 'Con Orden de Compra', className: 'bg-teal-500 text-white' }
```

También agregar `failed` para cubrir todos los estados del tipo `ServiceStatus`:
```
failed: { label: 'Fallido', className: 'bg-red-700 text-white' }
```

## Archivo
- `src/components/services/VehicleHistory.tsx` — agregar 2 estados faltantes al `statusConfig`

