# reports

## Resumen
Modulo de **reportes** operativos y financieros con filtros, tabs por dominio, graficos y exportaciones especializadas.

La pagina actual no es un dashboard unico generico: funciona como shell de navegacion por 8 tabs y usa hooks especializados para filtros, acciones, tiempo real y exportacion.

## Entrypoints vigentes
- Pagina: [ReportsPage](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/reports/ReportsPage.tsx)
- Componentes: [src/components/reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/reports)
- Exportadores: [src/utils/reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/utils/reports)

## Ruta
- `/reports`

## Arquitectura actual de la pagina
La pagina principal organiza el contenido por 8 tabs de dominio:

- `servicios` — KPI de servicios, detalle operacional
- `ingresos` — ingresos, margen, facturas pendientes/vencidas
- `clientes` — ranking de clientes, filtro por cliente
- `operadores` — ranking de operadores, filtro por operador, ficha de operador seleccionado
- `flota` — metricas de gruas
- `finanzas` — indicadores financieros
- `costos` — costos por categoria, filtro por categoria de costo
- `disputas` — reporte autocontenido de disputas con filtros propios

### Novedades julio 2026
- **Filtro por operador** en tab `Operadores` con selector contextual
- **Detalle de servicios** en pantalla: tabla debajo del informe con fecha, folio, cliente, tipo, operador, grua, origen, destino, estado y valor
- **Exportaciones con detalle:** PDF y Excel incluyen hoja/seccion `Detalle Servicios` en General, Operadores y Costos
- **Exportador dedicado de operadores:** `operatorReportExporter` con ranking, resumen del periodo y estados
- **Exportador de costos actualizado:** `costReportExporter` con detalle de servicios del periodo
- **Canonicalizacion de empresas:** `companyCanonicalization` evita duplicados por RUT invalido en selector de empresa
- **Optimizacion de rendimiento:** constantes de referencia estables (`EMPTY_OPERATORS`, `EMPTY_COSTS`, `EMPTY_CRANE_PARTS`) y `try/finally` en calculo de metricas para evitar loop de loading
- **Iconografia unificada:** `UserCog` de Lucide para la pestaña Operadores

## Hooks y servicios clave
- `useReports` — metricas, KPIs, serviceDetails
- `useReportFilters` — filtros por periodo, cliente, empresa, operador, categoria de costo
- `useReportActions` — exportacion general y de operadores
- `useReportCharts` — graficos por tab
- `useCostReportActions` — exportacion de costos
- `useReportsRealtime` — tiempo real

## Datos y dependencias principales
Fuentes de datos frecuentes:

- `services`
- `invoices`
- `clients`
- `operators`
- `cranes`
- `costs`
- `crane_parts`
- `company_data`
- `company_profiles`

Exportadores y utilidades vigentes:

- `src/utils/reports/operationalReportExporter.ts` — PDF/Excel general con detalle de servicios
- `src/utils/reports/operatorReportExporter.ts` — PDF/Excel de operadores con ranking y detalle
- `src/utils/reports/costReportExporter.ts` — PDF/Excel de costos con detalle de servicios
- `src/utils/reports/reportTypes.ts` — tipos compartidos
- `src/utils/companyCanonicalization.ts` — canonicalizacion de empresas
- uso de `jspdf` y `jspdf-autotable`

## Flujos vigentes

### 1. Navegacion por subdominios
- La pagina no muestra todas las capacidades a la vez.
- Cada tab agrupa filtros, dataset y visualizaciones propias.
- Los filtros de cliente, empresa y operador se muestran condicionalmente segun el tab activo.

### 2. Filtros y graficos
- Los filtros del modulo viven en hooks dedicados del dominio reportes.
- La generacion de graficos y KPIs responde al tab activo y al dataset cargado.
- Periodo predefinido (hoy, 7d, 30d, mes, trimestre, año) + personalizado con date pickers.

### 3. Exportacion
- Servicios, operadores y costos tienen exportadores especializados.
- Todos los exportadores incluyen detalle de servicios del periodo.
- El detalle exportado respeta los filtros activos (periodo, cliente, empresa, operador, categoria).

### 4. Tiempo real
- El modulo puede reaccionar a cambios de datos mediante hooks de realtime dedicados.

## Consideraciones de mantenimiento
- Usar `ReportsPage` y los hooks de `src/hooks/reports/*` como fuente de verdad del modulo.
- Distinguir entre piezas activas en la UI y componentes heredados o no conectados.
- Referenciar exportadores en `src/utils/reports`, no en una carpeta PDF generica, cuando se documente el flujo actual.
- Al agregar un nuevo tab, actualizar `tabs[]`, `effectiveFilters`, metricas, exportacion y graficos.
