# reports

## Resumen
Modulo de **reportes** operativos y financieros con filtros, tabs por dominio, graficos y exportaciones especializadas.

La pagina actual no es un dashboard unico generico: funciona como shell de navegacion por tabs y usa hooks especializados para filtros, acciones, tiempo real y exportacion.

## Entrypoints vigentes
- Pagina: [Reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Reports.tsx)
- Componentes: [src/components/reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/reports)
- Exportadores: [src/utils/reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/utils/reports)

## Ruta
- `/reports`

## Arquitectura actual de la pagina
La pagina principal organiza el contenido por tabs de dominio:

- `servicios`
- `ingresos`
- `clientes`
- `operadores`
- `flota`
- `finanzas`
- `costos`

Notas relevantes:
- La UI real se arma desde `ReportsPage`.
- Existen componentes importados o heredados no montados en la pagina principal, como algunos dashboards o piezas de mantenimiento.

## Hooks y servicios clave
- `useReports`
- `useReportFilters`
- `useReportActions`
- `useReportCharts`
- `useCostReportActions`
- `useReportsRealtime`

## Datos y dependencias principales
Fuentes de datos frecuentes:

- `services`
- `invoices`
- `clients`
- `operators`
- `cranes`
- `costs`
- `company_data`

Exportadores y utilidades vigentes:

- exportadores PDF y XLSX en `src/utils/reports/*`
- uso de `jspdf` y `jspdf-autotable`

## Flujos vigentes

### 1. Navegacion por subdominios
- La pagina no muestra todas las capacidades a la vez.
- Cada tab agrupa filtros, dataset y visualizaciones propias.

### 2. Filtros y graficos
- Los filtros del modulo viven en hooks dedicados del dominio reportes.
- La generacion de graficos y KPIs responde al tab activo y al dataset cargado.

### 3. Exportacion
- Servicios y costos tienen exportadores especializados.
- No conviene documentar la exportacion como un helper PDF generico aislado del modulo.

### 4. Tiempo real
- El modulo puede reaccionar a cambios de datos mediante hooks de realtime dedicados.

## Consideraciones de mantenimiento
- Usar `ReportsPage` y los hooks de `src/hooks/reports/*` como fuente de verdad del modulo.
- Distinguir entre piezas activas en la UI y componentes heredados o no conectados.
- Referenciar exportadores en `src/utils/reports`, no en una carpeta PDF generica, cuando se documente el flujo actual.
