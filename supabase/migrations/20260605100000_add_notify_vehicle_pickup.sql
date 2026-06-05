-- Agregar flag para notificación de retiro de vehículo (inspección inicial)
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS notify_vehicle_pickup BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_settings.notify_vehicle_pickup
  IS 'Enviar WhatsApp al cliente cuando el operador completa la inspección de retiro del vehículo';
