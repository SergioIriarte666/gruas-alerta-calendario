-- Actualizar la restricción de backup_type para permitir todos los tipos usados en el sistema
ALTER TABLE public.backup_logs DROP CONSTRAINT IF EXISTS backup_logs_backup_type_check;

-- Crear nueva restricción con todos los tipos de backup que usa el sistema
ALTER TABLE public.backup_logs ADD CONSTRAINT backup_logs_backup_type_check 
CHECK (backup_type IN ('full', 'quick', 'auto', 'full_sql', 'full_json', 'quick_json'));