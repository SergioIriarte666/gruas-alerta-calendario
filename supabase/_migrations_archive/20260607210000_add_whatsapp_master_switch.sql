BEGIN;

ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

COMMIT;
