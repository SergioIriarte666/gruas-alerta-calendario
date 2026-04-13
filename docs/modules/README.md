# Documentación Técnica por Módulo

Este directorio contiene documentación técnica **por módulo funcional** del sistema. Cada archivo describe arquitectura, componentes, API expuesta (superficie pública del frontend + operaciones Supabase), dependencias, configuración, diagramas y consideraciones de seguridad/rendimiento.

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
- [incomes](./incomes.md): ingresos y aplicación de pagos.
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
- Documentación general: [docs/README.md](../README.md)
- Configuración técnica: [docs/technical/configuration.md](../technical/configuration.md)
- PWA: [docs/technical/pwa-configuration.md](../technical/pwa-configuration.md)
- Guía admin: [docs/technical/system-admin-guide.md](../technical/system-admin-guide.md)
