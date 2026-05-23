## Plan: Respaldo diario automático por correo

### Objetivo
Cada día a las 03:00 (hora Chile) el sistema generará un respaldo **SQL** y un **JSON** de la base de datos, los subirá a Supabase Storage y enviará un correo a **asistencia@gruas5norte.cl** con dos links de descarga firmados (vigencia 7 días).

---

### 1. Infraestructura

**Bucket de Storage (privado):** `backups-auto`
- Solo accesible vía URLs firmadas
- Política RLS: solo `service_role` puede leer/escribir
- Retención: archivos > 30 días se borran automáticamente (cron de limpieza)

**Tabla `backup_email_config`** (1 fila, editable por admin desde Settings):
- `recipient_email` (default: asistencia@gruas5norte.cl)
- `enabled` (boolean)
- `schedule_hour` (default: 3 = 03:00 AM Chile)
- `last_sent_at`, `last_status`, `last_error`

---

### 2. Edge Function nueva: `scheduled-backup-email`

Flujo:
1. Lee `backup_email_config`. Si `enabled = false`, sale.
2. Invoca internamente la lógica de `generate-sql-dump` → obtiene `.sql`.
3. Invoca internamente la lógica de `generate-backup` (formato JSON) → obtiene `.json`.
4. Sube ambos archivos a `backups-auto/YYYY-MM-DD/` con nombres:
   - `tms-gruas-backup-YYYY-MM-DD.sql`
   - `tms-gruas-backup-YYYY-MM-DD.json`
5. Genera **signed URLs** con expiración de 7 días.
6. Envía correo HTML (diseño violeta, consistente con módulo de Costos) con:
   - Asunto: `Respaldo TMS Grúas - {fecha}`
   - Resumen: tamaño de cada archivo, fecha de generación, total de tablas/registros
   - Dos botones: "Descargar SQL" y "Descargar JSON"
   - Aviso de expiración (7 días)
   - Pie con instrucciones de almacenamiento seguro
7. Registra el envío en `backup_logs` (tipo `auto_email`) y actualiza `backup_email_config`.
8. Si falla, envía correo de alerta con el error y deja registro `failed`.

---

### 3. Envío de correo

Usar **Lovable Emails** (infraestructura nativa). Requiere:
- Verificar/configurar dominio de correo (subdominio `notify.gruas5norte.com` delegado a Lovable)
- Setup de `email_infra` y scaffold transactional
- Template React Email `backup-daily-report.tsx` con marca Grúas 5 Norte

> Si el dominio no está configurado todavía, el primer paso de la implementación será mostrar el diálogo de setup.

---

### 4. Programación (pg_cron)

Job `daily-backup-email` ejecutándose todos los días a las **03:00 America/Santiago** (= 06:00 UTC en horario estándar), invocando `scheduled-backup-email` vía `net.http_post` con la anon key.

```text
0 6 * * *   →  scheduled-backup-email
```

Job adicional `cleanup-old-backups` semanal (domingo 04:00) que borra del bucket archivos > 30 días.

---

### 5. UI: nueva sección en Settings → Respaldos

Componente `BackupEmailSchedulerSection.tsx` (debajo de `BackupManagementSection`):
- Switch "Envío diario por correo"
- Input "Correo destinatario" (con validación)
- Select "Hora de envío" (00-23, default 03)
- Botón "Enviar prueba ahora" (dispara la edge function manualmente)
- Estado: último envío, status, próximo envío programado
- Historial: lista de los últimos 10 envíos automáticos desde `backup_logs`

Diseño siguiendo patrón del módulo Costos (cards violetas, badges de estado, tipografía consistente).

---

### Archivos a crear/editar

**Nuevos:**
- `supabase/functions/scheduled-backup-email/index.ts`
- `supabase/functions/scheduled-backup-email/backupRunner.ts` (reusa lógica existente)
- `supabase/functions/_shared/transactional-email-templates/backup-daily-report.tsx`
- `src/components/settings/backup/BackupEmailSchedulerSection.tsx`
- `src/hooks/useBackupEmailConfig.ts`
- Migración SQL: bucket `backups-auto`, tabla `backup_email_config`, RLS, pg_cron jobs

**Editar:**
- `src/components/settings/BackupManagementSection.tsx` → incluir nuevo componente
- `supabase/functions/_shared/transactional-email-templates/registry.ts` → registrar template

---

### Fuera de alcance
- No se modifica el flujo de respaldo manual existente (botones SQL/JSON siguen igual)
- No se envían respaldos por WhatsApp (solo correo)
- No se cifra el archivo (URL firmada da seguridad temporal suficiente)
- No se sube a Drive/Dropbox externo (solo Storage de Supabase)

---

### Confirmación necesaria antes de implementar
1. ¿Confirmas hora de envío **03:00 Chile**? (o prefieres otra)
2. ¿Te parece bien expiración de **7 días** para los links?
3. Si el dominio de correo no está configurado, ¿avanzamos con el setup como parte de esta tarea?

Si todo OK, procedo.