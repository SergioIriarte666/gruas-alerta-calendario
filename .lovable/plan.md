

## Plan: Filtrar movimientos cancelados en reportes de inventario

### Problema

Los reportes de Gestión de Bodega no filtran movimientos con `status = 'cancelled'`, lo que infla cantidades y valores. Ejemplo: "Bornes Baterias" muestra 24 unidades y $120.000 cuando debería mostrar 6 unidades y $30.000, porque cuenta 2 movimientos cancelados además de los activos.

El stock real (`inventory_stock`) está correcto en 0 — el problema es exclusivamente en las consultas de reportes.

### Solución

Agregar `.eq('status', 'active')` a las 3 consultas de `useInventoryReports.ts` que no lo tienen.

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useInventoryReports.ts` | Agregar `.eq('status', 'active')` en `useMovementReport` (línea ~232), `useCostAnalysisReport` (línea ~331), y `usePredictiveAnalysis` (línea ~429) |

### Detalle técnico

```typescript
// useMovementReport - después de los filtros existentes (~línea 231)
query = query.eq('status', 'active');

// useCostAnalysisReport - después del .not('total_cost'...) (~línea 331)
query = query.eq('status', 'active');

// usePredictiveAnalysis - después del .gte('movement_date'...) (~línea 429)
.eq('status', 'active');
```

### Lo que NO se toca

- `useInventory.ts` — ya filtra por `status = 'active'` correctamente
- `useCraneParts.ts` — ya filtra correctamente
- `useCraneInventoryMetrics.ts` — ya filtra correctamente
- Stock view, MovementsHistoryTable — funcionan bien
- Ningún módulo dependiente (Costos, Grúas, Proveedores)

