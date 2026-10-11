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


## Respaldo diario y copia externa

- `scheduled-backup-email` genera un SQL comprimido de todas las tablas públicas en `backups-auto`.
- `backup_dump_chunk_v2` limita cada respuesta por bytes y permite continuar dentro de una tabla con `next_table` y `next_offset`. El encabezado de cada tabla aparece una sola vez; el cierre conserva su número total de filas.
- `sync-backups-to-r2` copia el archivo a R2 y verifica tamaño y SHA-256.
- `backup-watchdog` revisa generación y copia externa dentro de una ventana de 26 horas.
- `verify-backup-restore` prueba la restauración de clientes y servicios en tablas temporales.

### Incidente de octubre de 2026

La generación dejó de completarse después del 2 de octubre. Los logs del 11 de octubre confirmaron `Memory limit exceeded` (275 MB): el RPC anterior podía devolver una tabla entera aunque excediera el tamaño del bloque. La reparación pagina también dentro de las tablas y comprime incrementalmente bloques de aproximadamente 500 KB. Además, las llamadas de cron para generación, copia y verificación tienen un plazo explícito de 120 segundos, en lugar del valor predeterminado de 5 segundos.

Validación local: `node scripts/tests/backup-chunks.mjs` y `deno test supabase/functions/scheduled-backup-email/dumpSql.test.ts`.


La reparación se desplegó en producción el 11 de octubre. La ejecución por `pg_net` respondió HTTP 200 y generó `2026-10-11/tms-gruas-backup-2026-10-11.sql.gz` en aproximadamente 22 segundos (163 bloques). Se comprobó el contenido descomprimido: 144 encabezados únicos, 144 cierres de tabla y 90.271 INSERTs, coincidentes con los totales del log. La copia a R2 verificó 9.733.645 bytes y SHA-256 `OAug7ooK56Bs6X9F1nqBdxM157Mff9FIwtgYimulXDI=`. El simulacro desde R2 restauró 471 clientes y 1.809 servicios, sin diferencias. La generación de comprobación usó `skip_email: true`; el envío diario conserva su configuración habitual (12:00, America/Santiago).
