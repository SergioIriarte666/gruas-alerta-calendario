
-- Crear constraint UNIQUE para folios en la tabla services
ALTER TABLE public.services ADD CONSTRAINT services_folio_unique UNIQUE (folio);

-- Crear índice para mejorar rendimiento de consultas de folios
CREATE INDEX IF NOT EXISTS idx_services_folio ON public.services (folio);
