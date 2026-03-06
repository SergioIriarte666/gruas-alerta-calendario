

## Plan: Vista Pipeline por Cliente con Desglose Mensual para Históricos

### Objetivo
Agregar una vista tipo "pipeline" (similar a `IncomesPipelineView`) en ambas pestañas de Históricos (Ventas y Compras), donde los datos se agrupan por cliente y dentro de cada cliente se desglosan por mes.

### Diseño

**Vista general**: Cards colapsables por cliente (como `IncomesPipelineView`), con borde superior de color dinámico, icono de usuario, badge con cantidad, y monto total. Dentro de cada cliente, sub-agrupación por mes (ej: "Marzo 2026", "Febrero 2026") con sus totales.

### Cambios

1. **Nuevo componente `HistoricalSalesPipelineView.tsx`**
   - Recibe las facturas filtradas y las agrupa por cliente
   - Dentro de cada cliente, agrupa por mes (usando `issue_date`)
   - Cada mes muestra cards individuales con folio, monto, estado (badge), fecha
   - Incluye métricas resumidas por cliente (total facturado, cantidad de facturas, promedio mensual)
   - Usa `Collapsible` para clientes y sub-collapsibles para meses
   - Colores dinámicos por cliente (hash del nombre, mismo patrón que `IncomesPipelineView`)

2. **Nuevo componente `HistoricalPurchasesPipelineView.tsx`**
   - Mismo concepto pero para compras (supplier_invoices)
   - Agrupa por proveedor en vez de cliente
   - Muestra invoice_number, monto, estado, fecha

3. **Modificar `HistoricalSales.tsx`**
   - Agregar un tercer modo de vista al toggle existente (tabla / agrupado / pipeline)
   - O reemplazar el toggle "Agrupar por cliente" con un selector de 3 vistas: Tabla, Agrupado, Pipeline

4. **Modificar `HistoricalPurchases.tsx`**
   - Agregar toggle similar para alternar entre tabla y vista pipeline por proveedor/mes

### Patrón de diseño
- Seguir exactamente el estilo visual de `IncomesPipelineView`: bordes con color, iconos, badges, collapsibles, búsqueda integrada
- Cards dentro de cada mes en grid responsive (1-4 columnas)
- Cada card muestra: folio, fecha, monto, estado con badge de color

### Componentes reutilizados
- `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent`
- Badges de estado existentes
- Función `formatCurrency` y `toTitleCase`

