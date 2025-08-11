
-- Eliminar la restricción existente
ALTER TABLE public.notification_logs DROP CONSTRAINT notification_logs_type_check;

-- Crear nueva restricción que incluya 'inventory_alert'
ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_type_check 
CHECK (type IN ('push', 'email', 'in_app', 'inventory_alert'));
