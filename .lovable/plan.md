

# Plan: Acortar etiquetas de estado largas en badges

## Problema
Las etiquetas "Con Orden de Compra" y "Esperando O.C." son demasiado largas para badges, causando que se vean desordenados y ocupen demasiado espacio, especialmente en tablas y modales.

## Solución
Usar abreviaciones consistentes en todos los badges de estado. Varios archivos del proyecto ya usan "Con O.C." y "Esperando O.C." — unificar todo.

## Cambios

### 1. `src/utils/statusHelpers.ts`
- `purchase_order_pending`: "Esperando O.C." → **"OC Pendiente"**
- `with_purchase_order`: "Con Orden de Compra" → **"Con O.C."**

### 2. `src/components/services/VehicleHistory.tsx`
- `purchase_order_pending`: "Esperando O.C." → **"OC Pendiente"**
- `with_purchase_order`: "Con Orden de Compra" → **"Con O.C."**

Esto afecta todas las tablas de servicios, el dashboard, el modal de detalles, el portal de clientes, y el historial de vehículos — todos usan estas mismas funciones/configs.

## Archivos
- `src/utils/statusHelpers.ts` — 2 labels
- `src/components/services/VehicleHistory.tsx` — 2 labels

