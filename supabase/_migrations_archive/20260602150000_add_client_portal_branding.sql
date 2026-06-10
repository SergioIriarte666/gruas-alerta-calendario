ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.clients.logo_url
  IS 'URL pública del logo en bucket company-assets. Se muestra en el portal cliente.';

COMMENT ON COLUMN public.clients.display_name
  IS 'Nombre comercial para el portal. Si es null se usa el campo name.';
