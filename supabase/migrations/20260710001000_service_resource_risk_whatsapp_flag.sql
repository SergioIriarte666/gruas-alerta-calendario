ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS notify_service_resource_risk BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_settings.notify_service_resource_risk
  IS 'Enviar alerta a admins cuando un servicio esta asignado a un recurso (grua/operador) con documentos vencidos o por vencer';
