
# Fix: Filtros no se aplican al exportar informes

## Problema

Cuando seleccionas un cliente y/o cambias el periodo, el PDF exportado muestra "Todos los clientes" y usa las fechas del sistema viejo de filtros. Esto ocurre porque:

1. `useReportActions` recibe `appliedFilters` (filtros viejos) en vez de `effectiveFilters` (que incluye las fechas del periodo seleccionado)
2. El `selectedClientId` del selector de clientes nunca se pasa a la funcion de exportacion
3. `serviceReportFilters` tambien usa sus propias fechas independientes, ignorando el periodo seleccionado

## Solucion

### Archivo: `src/components/reports/ReportsPage.tsx`

Pasar `effectiveFilters` en vez de `appliedFilters` a `useReportActions`, e inyectar el `selectedClientId` en los filtros de servicio:

```typescript
// Linea 135-137: Cambiar de
const { handleExport, handleExportServiceReport } = useReportActions({
  appliedFilters, serviceReportFilters, metrics,
});

// A
const effectiveServiceFilters = useMemo(() => ({
  dateRange: {
    from: format(periodDates.from, 'yyyy-MM-dd'),
    to: format(periodDates.to, 'yyyy-MM-dd'),
  },
  clientId: selectedClientId,
}), [periodDates, selectedClientId]);

const { handleExport, handleExportServiceReport } = useReportActions({
  appliedFilters: effectiveFilters,
  serviceReportFilters: effectiveServiceFilters,
  metrics,
});
```

### Archivo: `src/hooks/reports/useReportActions.ts`

Actualizar `getAppliedFilterLabels` para que refleje correctamente el cliente seleccionado en el PDF (ya funciona porque lee de `appliedFilters.clientId`, que ahora recibira `effectiveFilters` con el clientId correcto si lo inyectamos).

Pero `effectiveFilters` no tiene `clientId` - viene de `appliedFilters` que siempre es 'all'. Necesitamos tambien inyectar el `selectedClientId` en `effectiveFilters`:

```typescript
const effectiveFilters = useMemo(() => ({
  ...appliedFilters,
  dateRange: {
    from: format(periodDates.from, 'yyyy-MM-dd'),
    to: format(periodDates.to, 'yyyy-MM-dd'),
  },
  clientId: activeTab === 'clientes' ? selectedClientId : appliedFilters.clientId,
}), [appliedFilters, periodDates, selectedClientId, activeTab]);
```

Esto asegura que:
- Las fechas del periodo seleccionado se usan en la exportacion
- El cliente seleccionado en el tab Clientes se refleja tanto en las metricas como en el PDF
- El label "Cliente: Nombre" aparece correcto en el PDF en vez de "Todos los clientes"
