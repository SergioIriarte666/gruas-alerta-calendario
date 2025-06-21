
-- Agregar campo para controlar el próximo número de folio de servicios
ALTER TABLE public.company_data 
ADD COLUMN next_service_folio_number INTEGER NOT NULL DEFAULT 1000;

-- Establecer el valor inicial basado en los folios existentes
-- Si ya hay servicios, calcular el próximo número apropiado
UPDATE public.company_data 
SET next_service_folio_number = GREATEST(
  1000,
  (
    SELECT COALESCE(MAX(
      CASE 
        WHEN folio ~ '^[A-Z]+-(\d+)$' 
        THEN (regexp_match(folio, '^[A-Z]+-(\d+)$'))[1]::INTEGER + 1
        ELSE 1000
      END
    ), 1000)
    FROM public.services
  )
);
