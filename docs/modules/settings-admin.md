# settings-admin

## Resumen
Modulo de **settings admin** para configuracion general del sistema, usuarios, notificaciones, categorias, herramientas administrativas y respaldos embebidos.

La pagina actual esta estructurada por tabs y centraliza varias capacidades que en otros momentos vivieron separadas.

## Entrypoints vigentes
- Pagina: [Settings](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Settings.tsx)
- Componentes: [src/components/settings](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/settings)
- Herramientas admin: [src/components/admin](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/admin)

## Ruta
- `/settings`

## Arquitectura actual
Tabs vigentes de la pagina:
- `company`
- `timezone`
- `system`
- `payment-terms`
- `notifications`
- `users`
- `categories`
- `liberation`

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
- En la tab `notifications` conviven configuraciones generales y alertas de facturas.

### 2. Usuarios y permisos
- La gestion de usuarios incluye permisos por modulo.
- `ProtectedRoute` usa esos permisos para filtrar acceso a rutas.

### 3. System
- La tab de sistema ya integra gestion de respaldos embebida.
- Tambien conviven herramientas administrativas complementarias.

### 4. Herramientas de emergencia
- `AdminEmergencyPanel` incluye varias herramientas, entre ellas `PurchaseVoidTool`.

## Consideraciones de mantenimiento
- Mantener alineada la documentacion con las tabs reales de `Settings.tsx`.
- No separar backups y alertas de facturas como si no vivieran tambien dentro de settings.
