# Documentación Técnica por Módulo

Este directorio contiene documentación técnica **por módulo funcional** del sistema. Cada archivo describe arquitectura, componentes, API expuesta (superficie pública del frontend + operaciones Supabase), dependencias, configuración, diagramas y consideraciones de seguridad/rendimiento.

Este índice debe mantenerse **alineado con** [PRD.md](../../PRD.md). El `PRD.md` funciona como fuente ejecutiva y de alcance; `docs/modules/*` funciona como desglose técnico por módulo.

**Convenciones**
- Nomenclatura: `docs/modules/<modulo>.md` en *kebab-case*.
- Un “módulo” corresponde a un área funcional principal (rutas/páginas + componentes asociados) o a una capa transversal (auth, integración Supabase, UI, etc.).
- Los diagramas se entregan en Mermaid para poder versionarse y mantenerse junto al código.

**Mapa rápido del sistema**

```mermaid
flowchart TD
  subgraph UI[Frontend (React + Vite)]
    Routes[Rutas (react-router-dom)]
    UIK[Componentes UI (shadcn/radix)]
    Hooks[Hooks (react-query)]
    Ctx[Contexts (Auth/User/Notifications)]
  end

  subgraph Data[Datos/Servicios]
    Supa[Supabase JS Client]
    RPC[RPC (Postgres Functions)]
    DB[(Tablas Postgres)]
  end

  Routes --> UIK
  Routes --> Hooks
  Routes --> Ctx
  Hooks --> Supa
  Ctx --> Supa
  Supa --> DB
  Supa --> RPC
```

## Alineación con el PRD

### Superficies principales del producto

| Superficie | Rutas base | Objetivo |
|---|---|---|
| Backoffice administrativo | `/dashboard`, `/services`, `/calendar`, `/closures`, `/clients`, `/cranes`, `/invoices`, `/costs`, `/inventory`, `/suppliers`, `/reports`, `/accounts-payable`, `/settings`, etc. | Operación, finanzas, activos y administración. |
| App de operador | `/operator`, `/operator/service/:id/inspection` | Ejecución en terreno, inspección, evidencia y seguimiento de servicios asignados. |
| Portal cliente | `/portal/*` | Autoservicio, solicitud de servicios y consulta documental. |

### Mapa rápido de módulos funcionales

| Módulo | Ruta principal | Propósito resumido | Documento técnico |
|---|---|---|---|
| Dashboard | `/dashboard` | KPIs, alertas y entrada al backoffice. | [dashboard](./dashboard.md) |
| Servicios | `/services` | Núcleo operativo del negocio. | [services](./services.md) |
| Calendario | `/calendar` | Planificación visual de servicios y eventos. | [calendar](./calendar.md) |
| Cierres | `/closures` | Puente entre operación y facturación. | [closures](./closures.md) |
| Clientes | `/clients` | Ficha, historial y gestión comercial. | [clients](./clients.md) |
| Grúas | `/cranes` | Activos, mantenciones y trazabilidad. | [cranes](./cranes.md) |
| Operadores | `/operators` | Administración de operadores. | [operators-admin](./operators-admin.md) |
| Facturas | `/invoices` | Facturación, pagos y reconciliación. | [invoices](./invoices.md) |
| Costos | `/costs` | Costos, XML/CSV y cruces operativos. | [costs](./costs.md) |
| Centros de costo | `/cost-centers` | Catálogo administrativo para costos y reportes. | [catalogos-admin](./catalogos-admin.md) |
| Inventario | `/inventory` | Stock, movimientos y compras enlazadas. | [inventory](./inventory.md) |
| Proveedores | `/suppliers` | Proveedores, pagos y documentos XML. | [suppliers](./suppliers.md) |
| Cuentas por pagar | `/accounts-payable` | Deudas, cuotas y obligaciones financieras. | [accounts-payable](./accounts-payable.md) |
| Reportes | `/reports` | Analítica y exportaciones. | [reports](./reports.md) |
| Proyecciones | `/income-projections` | Cashflow, aging y proyección. | [projections](./projections.md) |
| Comisiones | `/commissions` | Cálculo y control de comisiones. | [commissions](./commissions.md) |
| Quick Entries | `/quick-entries` | Captura rápida y asistencia OCR. | [quick-entry](./quick-entry.md) |
| Daily Report | `/daily-report` | Consolidado diario operativo/financiero. | [daily-report](./daily-report.md) |
| Trip Calculator | `/trip-calculator` | Rutas, peajes y estimaciones. | [trip-calculator](./trip-calculator.md) |
| Settings | `/settings` | Configuración, permisos y administración. | [settings-admin](./settings-admin.md) |
| Backup | `/backup` | Respaldo y utilidades críticas. | [backup](./backup.md) |
| Histórico financiero | `/historical` | Vistas históricas y analítica financiera. | [finance-historical](./finance-historical.md) |
| App operador | `/operator/*` | UX operativa simplificada para `operator`. | [operator-app](./operator-app.md) |
| Portal cliente | `/portal/*` | Solicitudes, servicios y facturas del cliente. | [portal](./portal.md) |
| Pipeline VIP | flujo asociado a clientes | Pipeline especial e importación PDF. | [vip-pipeline](./vip-pipeline.md) |

## Índice de módulos

### Guías reutilizables
- [advanced-functionalities](./advanced-functionalities.md): XML, batch processing, validación, manejo de errores, logging, configuración, pruebas y checklist.

### Núcleo y capas transversales
- [core-app](./core-app.md): entrypoint, routing, preloading de chunks, providers.
- [layout-navigation](./layout-navigation.md): layout, navegación, componentes UI base y patrones.
- [auth](./auth.md): autenticación y sesión (Supabase Auth).
- [supabase-integration](./supabase-integration.md): cliente Supabase, tipado, capa de servicios y acceso a datos.
- [notifications](./notifications.md): notificaciones UI y triggers (incluye push cuando aplique).
- [pwa](./pwa.md): PWA/service worker, instalación, conectividad.

### Módulos funcionales (rutas principales)
- [dashboard](./dashboard.md): panel principal, KPIs y alertas.
- [services](./services.md): gestión operativa de servicios.
- [calendar](./calendar.md): calendario y eventos.
- [clients](./clients.md): clientes, métricas e historial.
- [cranes](./cranes.md): grúas, mantenimiento, documentos y trazabilidad.
- [closures](./closures.md): cierres operativos y relación con facturación.
- [invoices](./invoices.md): facturación, pagos y reconciliación.
- [costs](./costs.md): costos, carga CSV/XML y trazabilidad.
- [inventory](./inventory.md): inventario, movimientos, alertas y sincronización.
- [suppliers](./suppliers.md): proveedores, pagos y XML.
- [accounts-payable](./accounts-payable.md): cuentas por pagar y deudas.
- [commissions](./commissions.md): comisiones y sincronización.
- [projections](./projections.md): proyecciones, cashflow y aging.
- [reports](./reports.md): reportes operativos/financieros y exportación (PDF/Excel).
- [settings-admin](./settings-admin.md): configuración del sistema y herramientas administrativas.
- [catalogos-admin](./catalogos-admin.md): catálogos administrables (tipos de servicio, tarifas, centros de costo, vehículos).
- [quick-entry](./quick-entry.md): capturas rápidas/pendientes.
- [backup](./backup.md): respaldo y utilidades de reparación/auditoría.
- [daily-report](./daily-report.md): reporte diario consolidado.
- [trip-calculator](./trip-calculator.md): cálculo de rutas/peajes/estimaciones.
- [operators-admin](./operators-admin.md): mantenimiento de operadores (admin).
- [operator-app](./operator-app.md): app de operador (inspección, evidencia, firma).
- [portal](./portal.md): portal cliente (servicios, solicitudes, facturas).
- [finance-historical](./finance-historical.md): vistas históricas y análisis financiero.
- [vip-pipeline](./vip-pipeline.md): pipeline VIP e importación PDF.

## Referencias existentes en el repositorio
- Fuente ejecutiva de producto: [PRD.md](../../PRD.md)
- Documentación general: [docs/README.md](../README.md)
- Configuración técnica: [docs/technical/configuration.md](../technical/configuration.md)
- PWA: [docs/modules/pwa.md](./pwa.md)
- Settings admin: [docs/modules/settings-admin.md](./settings-admin.md)
- Backup: [docs/modules/backup.md](./backup.md)

## Notas de mantenimiento

- Este índice debe seguir el routing real definido en `src/App.tsx`.
- Si un módulo deja de existir como ruta o superficie activa, su documentación debe archivarse o eliminarse del índice principal.
- El caso de `Incomes` queda fuera del mapa actual porque el flujo vigente de cobros/pagos se concentra en `Facturas` y `Proyecciones`.
