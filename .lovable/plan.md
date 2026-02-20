

# Exportar contextual por tab + filtro por cliente

## Problemas detectados

1. El dropdown "Exportar" muestra siempre las mismas 3 categorias (Metricas Generales, Informe de Servicios, Informe de Costos) sin importar en que tab estas navegando.
2. En el tab "Clientes" no hay forma de seleccionar un cliente particular para generar un informe especifico.
3. Los tabs Servicios, Ingresos, Clientes, Operadores y Flota renderizan todos el mismo componente `ReportsDashboard`, sin diferenciar contenido.

## Solucion

### 1. Exportar contextual segun el tab activo

Reemplazar el dropdown estatico de exportacion por uno dinamico que muestre solo las opciones relevantes al tab seleccionado:

| Tab | Opciones de exportacion |
|-----|------------------------|
| Servicios | Informe de Servicios (PDF/Excel) |
| Ingresos | Metricas Generales (PDF/Excel) |
| Clientes | Informe de Clientes (PDF/Excel) |
| Operadores | Metricas Generales (PDF/Excel) |
| Flota | Metricas Generales (PDF/Excel) |
| Finanzas | Metricas Generales (PDF/Excel) |
| Costos | Informe de Costos (PDF/Excel) |

### 2. Selector de cliente en tab "Clientes"

Agregar un `Select` adicional en la barra de filtros (solo visible cuando `activeTab === 'clientes'`) que permita elegir un cliente especifico de la lista `topClients` del metrics o de todos los clientes disponibles. Al seleccionar uno, las metricas del tab se filtran a ese cliente y la exportacion genera un informe particular.

### 3. Contenido diferenciado por tab

Ajustar `renderContent()` para que cada tab muestre informacion relevante:

- **Servicios**: Distribucion de servicios por estado + graficos de servicios por mes
- **Ingresos**: Graficos de ingresos por mes + metricas de rentabilidad
- **Clientes**: Top clientes con ranking + detalle del cliente seleccionado
- **Operadores**: Lista de operadores con metricas (reutilizar datos de `metrics`)
- **Flota**: Utilizacion de gruas con detalle
- **Finanzas**: Mantener como esta (OperationalReports)
- **Costos**: Mantener como esta (CostAnalysisReports)

---

## Detalle tecnico

### Archivo: `src/components/reports/ReportsPage.tsx`

**Cambio 1 - Dropdown contextual**: Extraer la logica del dropdown a una funcion `renderExportMenu()` que reciba `activeTab` y retorne solo las opciones correspondientes.

**Cambio 2 - Selector de cliente**: Agregar un estado `selectedClientId` y un `Select` con los clientes disponibles (de `useClients` o de `m.topClients`). Este select solo se renderiza si `activeTab === 'clientes'`.

**Cambio 3 - KPIs de clientes contextuales**: Cuando hay un cliente seleccionado, los KPIs del tab Clientes muestran datos de ese cliente (servicios, ingresos, ticket promedio) en vez de los globales.

**Cambio 4 - Contenido diferenciado**: Modificar `renderContent()` para que cada tab renderice un subconjunto distinto de la informacion del dashboard:
- `servicios`: Card de distribucion por estado (de ReportsDashboard)
- `ingresos`: Solo los graficos de ingresos y servicios por mes (PrimaryCharts)
- `clientes`: Card de Top Clientes con detalle expandido
- `operadores`: Metricas de operadores (servicios/operador)
- `flota`: Card de utilizacion de gruas expandida

Se importara `useClients` para tener la lista completa de clientes en el selector.

### Archivos a modificar:

1. **`src/components/reports/ReportsPage.tsx`** - Dropdown contextual, selector de cliente, contenido diferenciado por tab

