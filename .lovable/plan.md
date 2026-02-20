
# Fix: Eliminar filtros antiguos de Costos/Finanzas + Ranking de Operadores

## Problema

1. **Costos y Finanzas** muestran los acordeones "Filtros de Metricas" y "Filtros de Costos" con sus propios date pickers independientes. Estos ignoran el selector de periodo global de arriba (01/02 - 20/02) y siempre muestran 01/02 - 28/02. Son redundantes y confusos.

2. **Costos - Exportacion**: `useCostReportActions` recibe `costReportFilters` (fechas antiguas) en vez de las fechas del periodo seleccionado.

3. **Operadores**: Solo muestra 2 tarjetas basicas sin ranking de operadores por servicios (como si existe para Flota y Clientes).

---

## Cambios

### 1. `src/components/reports/ReportsPage.tsx`

**Costos (lineas 497-513)**: Eliminar el componente `ReportFilters` completo. Solo dejar `CostAnalysisReports`.

**Finanzas (lineas 474-496)**: Eliminar el componente `ReportFilters` completo. Solo dejar `OperationalReports`.

**Cost export (linea 148)**: Crear `effectiveCostFilters` que inyecte `periodDates` y pasarlo a `useCostReportActions`:

```typescript
const effectiveCostFilters = useMemo(() => ({
  dateRange: {
    from: format(periodDates.from, 'yyyy-MM-dd'),
    to: format(periodDates.to, 'yyyy-MM-dd'),
  },
  categoryId: 'all',
  craneId: 'all',
  operatorId: 'all',
}), [periodDates]);

const { handleExportCostReport } = useCostReportActions({ costReportFilters: effectiveCostFilters });
```

**Operadores (lineas 409-430)**: Reemplazar las 2 tarjetas por un ranking con barras de progreso (mismo patron visual que Flota), agrupando servicios por operador desde `filteredServices` via los datos de metricas.

### 2. `src/hooks/useReports.ts`

Agregar `operatorUtilization` al tipo `ReportMetrics` y calcularla en `calculateMetrics`, con el mismo patron que `calculateCraneUtilization`:

```typescript
operatorUtilization: { operatorId: string; operatorName: string; services: number; utilization: number }[]
```

La funcion agrupa servicios por `service.operator?.id`, cuenta servicios por operador, y calcula el porcentaje de utilizacion.

### Resultado esperado

- Costos y Finanzas: Sin filtros antiguos redundantes, usan el periodo global
- Exportacion de costos: Usa las fechas del periodo seleccionado
- Operadores: Ranking visual con barras de progreso mostrando nombre, servicios y porcentaje
