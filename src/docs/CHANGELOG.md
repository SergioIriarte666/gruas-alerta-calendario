# Registro de Cambios

Fecha: 2025-08-09

Cambios implementados en Reportes (Clientes con múltiples departamentos):

- Añadido filtro opcional "Departamento" en Filtros de Métricas.
  - Fuente de datos: departamentos únicos tomados desde los clientes existentes.
  - Aplica a todas las métricas calculadas en el dashboard de reportes.
- Métricas: Top de Clientes ahora incluye el campo de departamento.
  - Se muestra "Cliente — Departamento" en:
    - Dashboard Ejecutivo (Top 5 Clientes)
    - Detalle de Tablas (Reportes y Operacional)
    - Exportaciones (PDF y Excel) de reporte operacional
- Lógica de filtros globales actualizada para permitir filtrar por departamento además de cliente.

Archivos modificados:
- src/hooks/useReports.ts (tipos, filtro por departamento y topClients con departamento)
- src/hooks/reports/useReportFilters.ts (estado y handlers para `department`)
- src/components/reports/ReportFilters.tsx (UI de filtro de Departamento)
- src/components/reports/DetailTables.tsx (mostrar departamento)
- src/components/reports/operational/DetailTables.tsx (mostrar departamento)
- src/components/reports/dashboard/ReportsDashboard.tsx (mostrar departamento)
- src/utils/reports/operationalReportExporter.ts (PDF/Excel con departamento)
- src/hooks/reports/useOperationalMetrics.ts (tipo topClients extendido)

Notas:
- El campo Departamento proviene del cliente. En sistemas donde un cliente tiene múltiples departamentos, cada departamento suele estar modelado como un registro de cliente con el mismo RUT. Este cambio mejora la visibilidad sin requerir cambios de base de datos.
- Este cambio es global y no añade lógicas ad-hoc; se integra con los filtros y exportaciones existentes.
