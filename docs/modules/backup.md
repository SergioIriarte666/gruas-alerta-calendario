# backup

## Resumen
Modulo de **backup** y auditoria administrativa para generar respaldos y ejecutar herramientas de revision o reparacion relacionadas.

Hoy conviven dos flujos: una pagina dedicada `/backup` y una seccion embebida dentro de settings del sistema.

## Entrypoints vigentes
- Pagina: [BackupPage](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/BackupPage.tsx)
- Componentes: [src/components/backup](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/backup)
- Seccion embebida: `BackupManagementSection` en settings

## Ruta
- `/backup`

## Arquitectura actual
### Pagina dedicada
- `BackupManager` ejecuta flujo de `generate-sql-dump`
- integra auditoria y reparacion de comisiones con RPC dedicadas

### Flujo embebido en settings
- `useBackupManager`
- consulta `backup_logs`
- soporta `generate-backup`, descarga e historial reciente

## Hooks y servicios clave
- `useBackupManager`

## Datos y dependencias principales
- edge functions `generate-sql-dump` y `generate-backup`
- tabla `backup_logs`
- RPC `audit_commission_system`
- RPC `repair_commission_system`

## Flujos vigentes
### 1. Backup SQL desde pagina dedicada
- La pagina `/backup` usa un flujo directo orientado a dump y tooling admin.

### 2. Backup embebido en settings
- El hook administra generacion, descarga e historial de respaldos.

### 3. Auditoria y reparacion
- Existen herramientas de auditoria y reparacion del sistema de comisiones desde el modulo de backup.

## Consideraciones de mantenimiento
- No documentar RPC antiguas de backup como flujo vigente si el frontend actual no las invoca.
- Separar siempre pagina dedicada de seccion embebida en settings.
