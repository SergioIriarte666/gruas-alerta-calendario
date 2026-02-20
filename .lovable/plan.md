

# Fix: KPIs no se actualizan al cambiar el periodo

## Problema

El selector de periodo (Hoy, Este mes, etc.) calcula las fechas correctamente en `periodDates`, pero esas fechas nunca se pasan a `useReports()`. Los KPIs leen de `metrics` que viene de `useReports(appliedFilters)`, y `appliedFilters` solo se actualiza con el sistema viejo de filtros colapsables (boton "Actualizar").

En resumen: el selector de periodo y el hook de metricas estan desconectados.

## Solucion

Conectar `periodDates` directamente a los filtros que recibe `useReports`, reemplazando el `dateRange` de `appliedFilters` con las fechas del periodo seleccionado.

## Cambio en `src/components/reports/ReportsPage.tsx`

Crear un `useMemo` que combine `appliedFilters` con `periodDates` y pasarlo a `useReports`:

```typescript
const effectiveFilters = useMemo(() => ({
  ...appliedFilters,
  dateRange: {
    from: format(periodDates.from, 'yyyy-MM-dd'),
    to: format(periodDates.to, 'yyyy-MM-dd'),
  },
}), [appliedFilters, periodDates]);

const { metrics, loading, lastUpdate, forceRefresh } = useReports(effectiveFilters);
```

Esto asegura que al cambiar el periodo, las fechas se propagan inmediatamente a `useReports`, que recalcula todas las metricas y los KPIs de las 7 tarjetas se actualizan automaticamente.

No se requieren cambios en ningun otro archivo.
