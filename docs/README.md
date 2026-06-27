# Documentación TMS Grúas

## Objetivo

Este directorio reúne documentación operativa y técnica del sistema. La intención es dejar como **fuentes de verdad** solo los documentos esenciales y tratar el resto como apoyo histórico, notas de implementación o material de trabajo.

## Fuentes de verdad recomendadas

### Producto y alcance

- [PRD](../PRD.md): alcance actual del producto, módulos vigentes, rutas, integraciones y riesgos.
- [Documentación técnica por módulo](modules/README.md): mapa técnico alineado con el PRD y el código actual.

### Operación y configuración

- [Manual de usuario vigente](user-manual-vigente.md): guia funcional actual del sistema.
- [Guía de configuración WhatsApp](guia-configuracion-whatsapp.md): configuración operativa de WhatsApp Business.
- [Configuración técnica](technical/configuration.md): variables, parámetros globales y puesta en marcha.
- [Hardening Supabase](technical/supabase-security-hardening.md): endurecimiento de funciones, storage y auth para bajar warnings de seguridad.
- [Settings admin](modules/settings-admin.md): configuracion administrativa, usuarios, alertas y herramientas criticas.
- [Backup](modules/backup.md): respaldos, auditoria y utilidades administrativas.
- [Turnstile](technical/turnstile-configuration.md): configuracion opcional de captcha para recuperacion de contrasena.

### Arquitectura y capas transversales

- [Integración cruzada entre módulos](architecture/cross-module-integration.md): relaciones y sincronización entre áreas.
- [Core app](modules/core-app.md): bootstrap, providers globales y routing.
- [Integración Supabase](modules/supabase-integration.md): acceso a datos, cliente tipado y patrones de uso.
- [Notificaciones](modules/notifications.md): notificaciones UI, push y mensajería relacionada.
- [PWA](modules/pwa.md): capacidades offline, service worker y sincronización.

## Criterio de lectura

- `PRD.md` define el alcance funcional real.
- `docs/modules/*` detalla la implementación por módulo.
- `docs/technical/*` mezcla documentación transversal vigente con notas puntuales de soporte/corrección; priorizar `configuration.md`, `turnstile-configuration.md`, `manual-cost-xml-import.md`, `inspection-retention-r2.md` y `payment-system.md`.
- `docs/modules/*` y `docs/architecture/cross-module-integration.md` resumen la arquitectura vigente mejor que documentos generales antiguos.

## Material no canónico

La documentación que no esté enlazada desde este índice, `PRD.md` o `docs/modules/README.md` debe tratarse como material de apoyo, notas históricas o planificación puntual, y siempre contrastarse con el código actual.

En particular:

- `docs/enhancements/*` contiene planificación y propuestas, no necesariamente funcionalidades activas
- documentos históricos o de implementación puntual pueden archivarse o eliminarse si dejan de aportar valor operativo
