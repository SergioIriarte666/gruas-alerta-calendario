

## Plan: Panel Financiero Completo - Resultados Historicos

### Resumen
Nueva tercera pestana "Resultados" en la pagina de Historicos que cruza datos de ventas (invoices) y compras (supplier_invoices) para mostrar una vision financiera completa con KPIs, graficos, rankings, filtros y alertas.

### Componente nuevo: `src/components/finance/historical/HistoricalResults.tsx`

**KPIs (4 tarjetas superiores):**
- Total Ventas del periodo
- Total Compras del periodo
- Margen Bruto (Ventas - Compras) con indicador de color
- Ratio Compras/Ventas (%)

**Graficos:**
1. **Barras agrupadas** - Ventas vs Compras por mes (ultimos 12 meses)
2. **Linea de tendencia** - Evolucion del margen bruto mensual
3. **Pie chart** - Distribucion de compras por proveedor (top 5 + otros)
4. **Barras** - Comparacion interanual (ano actual vs anterior)

**Rankings:**
- Top 5 clientes mas rentables (ventas asociadas)
- Top 5 proveedores con mayor gasto

**Tabla resumen mensual:**
- Columnas: Mes, Ventas, Compras, Margen, Variacion % vs mes anterior
- Filas con margen negativo resaltadas con badge de alerta

**Filtros:**
- Selector de periodo (Este ano, Ultimo ano, Personalizado con date-picker)
- Los datos se filtran en memoria con `useMemo` sobre ambos datasets

**Exportacion:**
- Boton exportar PDF/Excel del resumen mensual (reutilizando patrones existentes de `usePurchaseExport`)

### Datos
- Ventas: `useInvoices()` → `invoices` (filtrando por `issueDate`)
- Compras: `usePurchaseInvoices()` → `invoices` (filtrando por `issue_date`)
- No requiere cambios en base de datos ni nuevos hooks, todo se calcula client-side

### Cambios en `src/pages/Historical.tsx`
- Agregar tercer `TabsTrigger` "Resultados" con value `results`
- Agregar `TabsContent` correspondiente con el nuevo componente

### Patron de diseno
Seguira el mismo patron visual del modulo de Costos: Cards con iconos, font sizes, colores de badges, y graficos con recharts usando `hsl(var(--primary))` / `hsl(var(--destructive))`.

