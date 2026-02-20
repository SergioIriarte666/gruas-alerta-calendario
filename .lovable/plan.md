

# Rediseno completo de la UI del Modulo de Reportes

## Objetivo

Transformar la interfaz actual (4 tabs pequenos + filtros colapsables + KPIs fijos) en un diseno limpio con navegacion por tarjetas grandes con iconos, barra de filtros inline y KPIs contextuales por seccion, tal como muestran las pantallas de referencia.

## Cambios principales

### 1. Navegacion por tarjetas grandes con iconos

Reemplazar el `TabsList` compacto de 4 tabs por una fila de 7 tarjetas grandes con icono + texto, estilo boton:

- **Servicios** (icono BarChart3)
- **Ingresos** (icono TrendingUp)
- **Clientes** (icono Users)
- **Operadores** (icono HardHat)
- **Flota** (icono Truck)
- **Finanzas** (icono DollarSign)
- **Costos** (icono Receipt)

La tarjeta activa tendra fondo violeta con texto blanco. Las inactivas tendran fondo blanco con borde y texto oscuro.

### 2. Barra de filtros inline

Reemplazar los acordeones colapsables de filtros por una barra horizontal compacta con:

- **Selector de periodo**: Dropdown con opciones predefinidas (Hoy, Ultimos 7 dias, Ultimos 30 dias, Este mes, Mes anterior, Ultimos 3 meses, Este ano)
- **Rango de fechas**: Badge visual mostrando "01 feb - 28 feb 2026"
- **Boton Exportar**: Dropdown unificado (ya existente)

Todo en una sola linea, sin colapsar/expandir.

### 3. KPIs contextuales por tab

Cada tab mostrara sus propias metricas relevantes en tarjetas simples (sin icono, solo titulo + valor grande):

- **Servicios**: Total Servicios, Completados, Cancelados, Ingresos, Ticket Promedio
- **Ingresos**: Ingresos Totales, Ingreso Promedio, Mejor Mes, Crecimiento
- **Clientes**: Total Clientes, Ingresos Totales, Ingreso Promedio, Pareto 80/20
- **Operadores**: Total Operadores, Servicios por Operador, Mas Activo
- **Flota**: Total Gruas, Utilizacion Promedio, Grua Mas Activa
- **Finanzas**: Beneficio Neto, Margen, Facturas Pendientes, Vencidas
- **Costos**: Total Costos, Costo por Servicio, Ratio Costo/Ingreso

### 4. Eliminar KPIs globales fijos

Remover las 4 tarjetas de KPI que estan actualmente sobre los tabs (Ingresos Totales, Beneficio Neto, Servicios, Facturas Pendientes). Los KPIs seran contextuales dentro de cada tab.

---

## Detalle tecnico

### Archivos a modificar:

1. **`src/components/reports/ReportsPage.tsx`**
   - Reemplazar `TabsList` compacto por grid de tarjetas grandes con iconos (7 columnas)
   - Agregar estado para periodo seleccionado y logica de calculo de rango de fechas
   - Agregar barra de filtros inline (periodo + rango de fechas + exportar)
   - Eliminar grid de 4 KPIs globales
   - Expandir `TabsContent` a 7 secciones (Servicios, Ingresos, Clientes, Operadores, Flota, Finanzas, Costos)
   - Las secciones nuevas (Ingresos, Clientes, Operadores, Flota, Finanzas) reutilizaran componentes existentes como `ReportsDashboard`, `OperationalReports`, `CostAnalysisReports` o mostraran subconjuntos de metricas con graficos relevantes

2. **`src/components/reports/shared/ReportsHeader.tsx`**
   - Simplificar: solo titulo "Reportes" y subtitulo "Analisis y estadisticas del negocio"
   - Eliminar botones de Actualizar y Exportar del header (se mueven a la barra de filtros)

3. **`src/components/reports/shared/ReportFilters.tsx`**
   - Ya no se usara directamente en ReportsPage (la barra de filtros inline sera parte de ReportsPage)
   - Se mantiene por si otros componentes lo necesitan

4. **`src/components/reports/shared/ReportMetricCard.tsx`**
   - Simplificar: quitar icono, mostrar solo titulo (texto pequeno muted) + valor grande + subtexto opcional
   - Estilo limpio con borde redondeado, sin sombra

### Estructura visual resultante:

```text
+--------------------------------------------------+
| Reportes                                          |
| Analisis y estadisticas del negocio               |
+--------------------------------------------------+
| [Servicios] [Ingresos] [Clientes] [Operadores]   |
| [Flota]     [Finanzas] [Costos]                   |
+--------------------------------------------------+
| [Este mes v] [01 feb - 28 feb 2026] [Exportar v] |
+--------------------------------------------------+
| [KPI 1] [KPI 2] [KPI 3] [KPI 4] [KPI 5]         |
+--------------------------------------------------+
| [Grafico 1]              [Grafico 2]              |
+--------------------------------------------------+
```

### Logica de periodos predefinidos:

El selector de periodo calculara automaticamente las fechas `from` y `to`:
- Hoy: fecha actual
- Ultimos 7 dias: hoy - 7 dias
- Ultimos 30 dias: hoy - 30 dias
- Este mes: 1er dia del mes actual hasta ultimo dia
- Mes anterior: 1er dia del mes anterior hasta ultimo dia
- Ultimos 3 meses: hoy - 3 meses
- Este ano: 1 enero hasta hoy

