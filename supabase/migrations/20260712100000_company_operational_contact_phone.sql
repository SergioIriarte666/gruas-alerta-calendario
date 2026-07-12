BEGIN;

-- Telefono de contacto operativo, independiente del telefono legal/comercial
-- (company_data.phone). Se usa en el boton "Llamar a..." de la pagina
-- publica de seguimiento (/track/:token) — service-tracking lo lee via
-- service role y lo expone en el contrato publico como "support_phone".
ALTER TABLE public.company_data
  ADD COLUMN IF NOT EXISTS operational_contact_phone text;

COMMIT;
