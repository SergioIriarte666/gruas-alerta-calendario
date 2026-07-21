# settings-admin

## Resumen

Modulo de **settings admin** para configuracion general del sistema, usuarios, notificaciones, categorias, herramientas administrativas y respaldos embebidos.

La página usa una navegación superior de dos niveles: primero el área y luego únicamente sus secciones. En pantallas medianas y móviles se reemplaza por un selector agrupado. Esta estructura conserva el ancho completo para tablas, formularios y herramientas operativas.

## Entrypoints vigentes

- Página: [Settings](../../src/pages/Settings.tsx)
- Componentes: [src/components/settings](../../src/components/settings)
- Herramientas admin: [src/components/admin](../../src/components/admin)

## Ruta

- `/settings`

## Arquitectura actual

Áreas vigentes de la página:

- **Experiencia**: `appearance`.
- **Organización**: `company`, `timezone`, `payment-terms`.
- **Catálogos y costos**: `service-types`, `service-rates`, `cost-centers` (solo administradores).
- **Operación**: `notifications`, `categories`, `inspection-equipment`.
- **Acceso y trazabilidad**: `users`, `audit` (solo administradores).
- **Sistema e integridad**: `system`, `recovery`, `liberation`; las dos últimas son solo para administradores.

Cada sección conserva un hash navegable. `/settings#respaldos` abre Sistema directamente en la subsección de Gestión de Respaldos.

Las rutas históricas `/service-types`, `/service-rates` y `/cost-centers` redirigen a sus secciones dentro de Configuración. El sidebar mantiene `/settings#respaldos` como acceso directo a la vista de respaldos, sin duplicar el módulo.

### Preferencias visuales

- La pestaña `appearance` controla tema, densidad, escala de lectura, reducción de movimiento y estado del menú lateral.
- Los cambios se aplican inmediatamente, se respaldan en el navegador y se sincronizan por usuario en `user_settings`.
- Las reglas y límites de personalización se definen únicamente en [la guía visual](../design-system.md).

## Componentes y flujos clave

- `CompanySettingsTab`
- `TimezoneSettingsTab`
- `SystemSettingsTab`
- `NotificationSettingsTab`
- `InvoiceAlertSettings`
- `UserManagementTab`
- `UserPermissionsModal`
- secciones de categorias
- `AdminEmergencyPanel`

## Datos y dependencias principales

- configuracion de compania y zona horaria
- terminos de pago
- notificaciones generales y alertas de facturas
- usuarios y permisos por modulo
- backups embebidos dentro de system

## Flujos vigentes

### 1. Notificaciones

- `notifications` se divide en cuatro vistas internas: generales, facturas, correo y WhatsApp.
- Sólo se monta visualmente el canal activo, evitando una página vertical excesivamente extensa.

### 2. Usuarios y permisos

- La gestion de usuarios incluye permisos por modulo.
- `ProtectedRoute` usa esos permisos para filtrar acceso a rutas.

### 3. System

- `system` se divide en cuatro vistas internas: general, reporte diario, respaldos y reportes PDF.
- El hash histórico `#respaldos` se conserva y activa la vista interna correspondiente.

### 4. Herramientas de emergencia

- `AdminEmergencyPanel` incluye varias herramientas, entre ellas `PurchaseVoidTool`.

## Consideraciones de mantenimiento

- Mantener alineada la documentación con las áreas y secciones reales de `Settings.tsx`.
- No añadir una segunda barra lateral dentro de Configuración: el contenido debe conservar el ancho completo disponible.
- No separar backups y alertas de facturas como si no vivieran tambien dentro de settings.
