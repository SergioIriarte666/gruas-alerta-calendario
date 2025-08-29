# Registro de Cambios

Fecha: 2025-08-29

## Gestión de Categorías de Proveedores

Cambios implementados - Sistema completo de gestión de categorías dinámicas:

**Nueva Funcionalidad - Categorías de Proveedores:**
- Creada tabla `supplier_categories` en base de datos con campos: id, name, label, description, is_active.
- Hook `useSupplierCategoryManager` para operaciones CRUD completas (crear, leer, actualizar, eliminar).
- Componente `SupplierCategoryList` para visualizar y gestionar todas las categorías.
- Componente `SupplierCategoryForm` para crear y editar categorías con validación.
- Nueva pestaña "Categorías" agregada a la página principal de proveedores.
- Funcionalidades incluyen: crear, editar, eliminar, activar/desactivar categorías.
- Migración automática de categorías hardcodeadas existentes a la base de datos.
- Interfaz moderna usando componentes shadcn/ui con validación Zod.

**Mejoras Técnicas:**
- Row Level Security (RLS) habilitado para acceso seguro a categorías.
- Triggers automáticos para actualización de timestamps.
- Compatibilidad mantenida con código existente durante transición.
- Gestión de estados optimizada con React Query.
- Notificaciones toast integradas para feedback del usuario.

Archivos agregados:
- src/hooks/useSupplierCategoryManager.ts (lógica de gestión de categorías)
- src/components/suppliers/categories/SupplierCategoryList.tsx (lista y acciones)
- src/components/suppliers/categories/SupplierCategoryForm.tsx (formulario CRUD)

Archivos modificados:
- src/pages/Suppliers.tsx (nueva pestaña de categorías)
- src/hooks/useSuppliers.ts (comentario de compatibilidad)

Fecha: 2025-08-29

Cambios implementados en Proveedores (Corrección completa de problema de fechas):

**Calendario de Pagos:**
- Corregido desfase de 1 día en calendario de pagos de proveedores.
- Integradas las utilidades de `timezoneUtils.ts` para manejo correcto de fechas.
- Todas las comparaciones de fechas ahora usan zona horaria Chile/Santiago.
- Botón "Hoy" actualizado para usar fecha correcta del sistema.
- Formateo de fechas consistente con configuración del usuario.

**Lista de Pagos:**
- Corregido desfase de 1 día en la tabla de pagos y filtros de fecha.
- Reemplazadas todas las instancias de `new Date()` por utilidades de zona horaria.
- Filtros de fecha (Hoy, Esta Semana, Este Mes, Últimos 30 días) ahora usan zona horaria Chile.
- Comparaciones de fechas normalizadas usando strings YYYY-MM-DD.
- Display de fechas en tabla usando `formatForDisplay()` con zona horaria correcta.
- Eliminado uso directo de `date-fns` comparators (`isBefore`, `isAfter`, `isSameDay`).

Archivos modificados:
- src/components/suppliers/SupplierPaymentCalendar.tsx (lógica de fechas y zona horaria)
- src/components/suppliers/PaymentList.tsx (filtros de fecha, display y comparaciones)

Fecha: 2025-08-29

Cambios implementados en Métricas de Servicios (Corrección de problema de fechas):

- Corregido problema de zona horaria en métricas de servicios.
  - Integradas las utilidades de `timezoneUtils.ts` para manejo correcto de fechas.
  - Filtro "Hoy" ahora usa comparación exacta (`service_date = fecha_actual`) en lugar de rangos.
  - Todos los filtros de fecha ahora consideran la zona horaria Chile/Santiago configurada.
  - Agregado logging para debugging de filtros de fecha.
- Las métricas ahora muestran correctamente el conteo de servicios para cada período.

Archivos modificados:
- src/hooks/services/useServicesMetrics.ts (lógica de filtrado de fechas y zona horaria)

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
