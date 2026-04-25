## Objetivo

Reescribir completamente `PRD.md` para reflejar el estado real y actual del sistema **TMS Grúas** (versión actual ≥ 2.2.x con todos los módulos en producción), pasando de un documento de ~78 líneas a un PRD **exhaustivo** que sirva como fuente única de verdad para producto, ingeniería, soporte y onboarding.

---

## Alcance del nuevo PRD

El documento cubrirá los **33 módulos funcionales** ya implementados (visibles en `docs/modules/`) más capas transversales, reglas de negocio, integraciones, seguridad, datos y roadmap.

### Estructura propuesta (índice)

1. **Resumen Ejecutivo**
   - Visión, propuesta de valor, mercado objetivo (empresas de grúas en Chile), versión actual y estado.

2. **Glosario y convenciones**
   - Términos: servicio, folio, cierre, DTE, custodia, VIP, etc.
   - Moneda CLP, zona horaria America/Santiago, formatos de fecha.

3. **Personas y roles**
   - `admin`, `viewer`, `operator`, `client` con permisos detallados y matriz de acceso por módulo.
   - Sistema de permisos granulares por módulo.

4. **Mapa funcional del sistema**
   - Diagrama de módulos y dependencias.
   - Flujos end-to-end principales: Solicitud → Asignación → Inspección → Cierre → Facturación → Cobro → Reporte.

5. **Especificación detallada por módulo** (una sub-sección por módulo, cada una con: propósito, usuarios, funcionalidades, reglas de negocio, dependencias, KPIs):
   - **Núcleo y transversales**: core-app, layout-navigation, auth, supabase-integration, notifications, PWA, backup.
   - **Operación**: dashboard, services, calendar, quick-entry, daily-report, trip-calculator, operator-app, portal cliente.
   - **Activos y catálogos**: cranes, operators-admin, clients, suppliers, inventory, catalogos-admin (service-types, service-rates, cost-centers, vehicles), settings-admin.
   - **Financiero**: closures, invoices, costs, accounts-payable, commissions, incomes, projections, finance-historical, reports, vip-pipeline.

6. **Reglas de negocio críticas** (consolidadas desde memorias del proyecto):
   - Cierres y facturación, sincronización bidireccional Costos ↔ Pagos a Proveedores, exclusión de comisiones específicas, relación 1:1 costo-factura, lógica de antigüedad y vencimiento de facturas, anulación con nota de crédito, no auto-asignación en conciliación, exclusión de clientes con facturación mensual, status de servicios protegido, preservación de fechas en costos, etc.

7. **Integraciones externas**
   - Supabase (Auth, DB, Storage, Edge Functions, Realtime), Resend (emails transaccionales: invitaciones, recordatorios, reset, reportes diarios, confirmaciones, alertas de documentos), Mapbox (rutas y peajes), GetAPI Chile / SRE (verificación de patentes y RUT), OpenAI (clasificación de costos, OCR de boletas), WhatsApp Cloud API (decisión de integración directa), pdfjs-dist (parsing PDF VIP).

8. **Edge Functions** (catálogo): `check-vehicle-patent`, `classify-cost`, `generate-backup`, `generate-sql-dump`, `mapbox-proxy`, `parse-receipt-image`, `send-*` (8 funciones de email/push), `sre-lookup`, `tollroutes-proxy`, etc., con propósito de cada una.

9. **Modelo de datos (alto nivel)**
   - Entidades principales y relaciones: services, costs, invoices, clients, cranes, operators, inventory_*, suppliers, debts, commissions, closures, notifications, user_roles, audit_logs.
   - RLS y `has_role()` security definer.

10. **Auditoría y trazabilidad**
    - `created_by`, `service_audit_log`, historial de cambios visible en UI (Servicios, Costos, Repuestos), logs de backup.

11. **Capacidad Offline / PWA**
    - IndexedDB v5, CRUD offline en módulos clave, sincronización automática, indicadores de conexión, instalación, push notifications.

12. **Seguridad**
    - RLS en todas las tablas, roles en tabla separada (`user_roles` + enum `app_role`), hardening de notificaciones y storage, restricciones de escritura en tablas financieras críticas, separación de claves API por servicio.

13. **Diseño y experiencia**
    - Sistema de diseño v3 (violet `#8b5cf6`, alto contraste, tokens en `index.css`, primitivos `PageHeader`, `MetricCard`, `StatusBadge`, `SectionCard`).
    - Estándares responsive y accesibilidad (preferencia violeta por discapacidad visual del usuario).
    - Patrón de modales con Radix Select estable.

14. **Requisitos no funcionales**
    - Rendimiento (TTI < 3s, precarga de rutas, React Query caching), disponibilidad (Supabase + Lovable hosting), escalabilidad, compatibilidad (Safari/WebKit, móvil), backups automáticos.

15. **Despliegue y entornos**
    - Preview, publicado (`t-m-s.lovable.app`), dominio propio (`gruas5norte.com`), despliegue continuo desde Lovable, edge functions automáticas, migraciones gestionadas.

16. **Métricas de éxito y KPIs del producto**
    - Operativos (servicios/día, tiempo de cierre, % inspecciones digitales), financieros (DSO, margen, tasa de cobro), técnicos (uptime, errores).

17. **Roadmap**
    - Fases completadas (1–5) con hitos reales y fase actual: WhatsApp directo, analítica predictiva, mejoras VIP pipeline, expansión de reportes.

18. **Apéndices**
    - A. Variables de entorno y secretos.
    - B. Catálogo de rutas (admin / operator / portal).
    - C. Referencias cruzadas a `docs/modules/*` y memorias del proyecto.
    - D. Historial de versiones resumido.

---

## Detalles técnicos / fuentes a consolidar

- Leer y sintetizar los 33 archivos de `docs/modules/*.md` para cada sub-sección.
- Incorporar reglas de negocio desde las memorias (`mem://features/*`, `mem://business-rules/*`, `mem://data-integrity/*`, `mem://constraints/*`, `mem://security/*`).
- Cruzar con `CHANGELOG.md`, `docs/changelog/releases.md`, `docs/technical/*` para versionado e hitos.
- Listar Edge Functions reales desde `supabase/functions/`.
- Mantener el documento en español y en formato Markdown puro (sin emojis decorativos en encabezados, salvo iconos ya presentes en el changelog si aportan claridad).
- Incluir 2–3 diagramas Mermaid clave (mapa de módulos, flujo end-to-end servicio→cobro, capas de arquitectura).

## Entregable

Un único archivo `PRD.md` reescrito completo (estimado 800–1.500 líneas), reemplazando la versión actual. No se modificará ningún otro archivo del código.

## Fuera de alcance

- No se modifica código de la aplicación, base de datos, edge functions ni documentación de `docs/`.
- No se generan PDFs ni artefactos descargables (a menos que lo pidas después).
