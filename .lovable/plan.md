

# Rediseno del Modulo de Reportes

## Problemas identificados

### 1. Interfaz confusa
- El header tiene 3 botones de exportacion separados (Metricas, Servicios, Costos) que saturan la barra superior
- Los filtros son extensos y se repiten entre tabs (filtros de metricas, filtros de servicios, filtros de costos)
- La navegacion por tabs es funcional pero la jerarquia visual no es clara

### 2. Metricas de Top Clientes y Utilizacion de Gruas incorrectas
- **Top Clientes**: El calculo en `useReports.ts` NO excluye servicios cancelados. Incluye 2 servicios cancelados por ~$2M en los totales por cliente
- **Utilizacion de Gruas**: El porcentaje se calcula como proporcion del total de servicios (incluyendo cancelados), no como utilizacion real. Ademas, no filtra servicios cancelados
- El mismo problema afecta `calculateServicesByMonth` y `calculateServicesByStatus`

---

## Solucion

### Parte 1: Correccion de metricas en `useReports.ts`

Filtrar servicios cancelados **antes** de pasarlos a todas las funciones de calculo:

```typescript
// En calculateMetrics(), despues de aplicar filtros del usuario:
filteredServices = filteredServices.filter(s => s.status !== 'cancelled');
```

Esto corrige automaticamente:
- `calculateTopClients` -- excluye ingresos de servicios cancelados
- `calculateCraneUtilization` -- excluye servicios cancelados del conteo
- `calculateServicesByMonth` -- datos mensuales sin cancelados
- `calculateServicesByStatus` -- distribucion sin cancelados
- Metricas totales (totalServices, totalRevenue, averageServiceValue)

### Parte 2: Rediseno de la interfaz

**Archivo: `src/components/reports/shared/ReportsHeader.tsx`**
- Simplificar el header: un solo boton "Exportar" con un dropdown que agrupe las 3 opciones (Metricas PDF/Excel, Servicios PDF/Excel, Costos PDF/Excel) usando secciones con separadores
- Quitar los 3 botones individuales de colores distintos que generan confusion

**Archivo: `src/components/reports/ReportsPage.tsx`**
- Mover los filtros dentro de cada tab como seccion colapsable (Accordion) en vez de componentes separados que ocupan espacio fijo
- Cada tab gestiona sus propios filtros de forma mas limpia

**Archivo: `src/components/reports/dashboard/ReportsDashboard.tsx`**
- Mejorar la seccion "Top 5 Clientes": agregar barra de progreso visual proporcional al ingreso maximo, numeracion con badges (1ro, 2do, 3ro...)
- Mejorar "Utilizacion de Gruas": agregar barra de progreso visual con colores segun % de uso, mostrar cantidad de servicios junto al porcentaje
- Mejorar "Distribucion de Servicios": usar badges con colores segun estado en vez de texto plano

**Archivo: `src/components/reports/shared/ReportMetricCard.tsx`**
- Ajustar para que use `text-muted-foreground` en las descripciones (actualmente todo es `text-foreground` dificultando la jerarquia visual)

### Parte 3: Filtros simplificados por tab

**Archivo: `src/components/reports/shared/ReportFilters.tsx`**
- Convertir cada seccion de filtros en un Collapsible que se expande/contrae
- Reducir la cantidad de controles visibles inicialmente
- Mantener la misma funcionalidad pero con mejor organizacion visual

---

## Detalle tecnico de cambios

### Archivos a modificar:

1. **`src/hooks/useReports.ts`** (~linea 89) -- Agregar filtro de cancelados despues del bloque de filtros del usuario
2. **`src/components/reports/shared/ReportsHeader.tsx`** -- Unificar 3 dropdowns en 1 con secciones agrupadas
3. **`src/components/reports/dashboard/ReportsDashboard.tsx`** -- Redisenar Top Clientes y Utilizacion de Gruas con barras de progreso y badges
4. **`src/components/reports/shared/ReportMetricCard.tsx`** -- Ajustar jerarquia de colores de texto

### Datos reales para validar:

| Cliente | Servicios | Ingresos |
|---------|-----------|----------|
| Auxilia Club | 199 | $91.398.400 |
| Arrendadora S.A. | 291 | $27.506.500 |
| Somacor S.A. | 17 | $10.840.000 |
| Amphos 21 | 75 | $9.511.460 |
| Salinas y Fabres | 255 | $8.620.000 |

| Grua | Servicios |
|------|-----------|
| Chevrolet FRR (TDCJ-46) | 608 |
| Chevrolet FRR (TLYF-23) | 226 |
| Toyota Hilux (VBPH-58) | 53 |

