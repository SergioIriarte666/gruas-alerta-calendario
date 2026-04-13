# reports

## Resumen
Módulo de **reportes** (operacionales/financieros) con:
- dashboards y métricas,
- filtros compartidos,
- exportación (PDF/Excel cuando aplica).

**Entrypoints**
- Página: [Reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Reports.tsx)
- Componentes: [src/components/reports](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/reports)
- Utilidades PDF: [src/utils/pdf](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/utils/pdf)

## Arquitectura y componentes
- Estructura por subdominio:
  - `reports/cost-analysis/*`
  - `reports/maintenance/*`
  - `reports/operational/*`
  - `reports/shared/*` (filtros, cards)
- Visualizaciones con `recharts`.
- Exportación PDF con `jspdf` + `jspdf-autotable` y helpers de encabezados/datos compañía.

## API expuesta

### Ruta (frontend)
- `/reports`

### Operaciones Supabase (tablas/RPC)
Tablas usadas comúnmente:
- `services`, `invoice_services`, `closure_services`
- `clients`, `operators`, `cranes`
- `company_data`

RPC relevante detectada:
- `get_overdue_invoices_for_alerts` (para reportes/alertas de vencimiento)

## Especificación de uso (con ejemplos)

### Generación PDF (patrón)
```ts
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const doc = new jsPDF()
autoTable(doc, { head: [['Col1', 'Col2']], body: [['A', 'B']] })
doc.save('reporte.pdf')
```

## Dependencias

### Externas (principales)
- `react`
- `recharts`
- `jspdf`, `jspdf-autotable`
- `date-fns`
- `lucide-react`

### Internas (principales)
- Hooks: `useReports`, `useDateFilters`, `useAdvancedFilters`
- Utilidades: `@/utils/pdf/*`, `@/utils/reportExporter`, `@/utils/currencyUtils`
- UI: `@/components/ui/*`

## Configuración requerida
- Datos de compañía (`company_data`) para encabezados y branding en PDFs.
- RLS: permitir lectura de datasets para reportes a roles autorizados.

## Casos de uso principales
- Reportes de costos, mantenimiento y métricas operacionales.
- Exportación de resultados para auditoría/contabilidad.

## Diagramas

```mermaid
flowchart TD
  UI[Reports UI] --> H[Hooks/Filtros]
  H --> SB[Supabase]
  SB --> DATA[(services/costs/invoices/...)]
  UI --> PDF[PDF utils (jsPDF)]
```

## Rendimiento
- Consultas para reportes pueden ser pesadas: filtrar por fecha/cliente y usar agregaciones server-side.
- PDFs grandes: generar en background y evitar bloquear el thread principal.

## Seguridad
- Reportes exportados pueden incluir PII/finanzas: controlar acceso y considerar watermarking/auditoría.
