ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS notify_operator_self_document BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_settings.notify_operator_self_document
  IS 'Enviar alerta directa al operador cuando sus propios documentos esten por vencer o vencidos';
