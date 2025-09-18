-- Add fields to company_data for EXE folio management
ALTER TABLE public.company_data 
ADD COLUMN IF NOT EXISTS excess_folio_format text DEFAULT 'EXE-{number}',
ADD COLUMN IF NOT EXISTS next_excess_folio_number integer DEFAULT 1;

-- Add relationship fields to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS related_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS service_relationship_type text CHECK (service_relationship_type IN ('main', 'excess'));

-- Create index for better performance on related services queries
CREATE INDEX IF NOT EXISTS idx_services_related_service_id ON public.services(related_service_id);

-- Create function to generate excess folios
CREATE OR REPLACE FUNCTION public.generate_excess_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  folio_format text;
  next_number integer;
  new_folio text;
  company_record record;
BEGIN
  -- Get company data with row lock to prevent race conditions
  SELECT excess_folio_format, next_excess_folio_number, id
  INTO company_record
  FROM public.company_data
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontraron datos de la empresa';
  END IF;
  
  -- Generate new folio
  folio_format := COALESCE(company_record.excess_folio_format, 'EXE-{number}');
  next_number := COALESCE(company_record.next_excess_folio_number, 1);
  new_folio := replace(folio_format, '{number}', lpad(next_number::text, 4, '0'));
  
  -- Update next number
  UPDATE public.company_data 
  SET next_excess_folio_number = next_number + 1,
      updated_at = now()
  WHERE id = company_record.id;
  
  RETURN new_folio;
END;
$$;

-- Create "Excedente" service type
INSERT INTO public.service_types (
  name, 
  description, 
  base_price,
  crane_required,
  operator_required,
  origin_required,
  destination_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  purchase_order_required,
  vehicle_info_optional,
  is_active
) VALUES (
  'Excedente',
  'Servicio de excedente para monto no cubierto por cliente principal',
  0,
  false,  -- crane not required (inherited from main service)
  false,  -- operator not required (inherited from main service)  
  false,  -- origin not required (inherited from main service)
  false,  -- destination not required (inherited from main service)
  false,  -- vehicle brand not required (inherited from main service)
  false,  -- vehicle model not required (inherited from main service)
  false,  -- license plate not required (inherited from main service)
  false,  -- purchase order not required
  true,   -- vehicle info is optional for excess services
  true
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  crane_required = EXCLUDED.crane_required,
  operator_required = EXCLUDED.operator_required,
  origin_required = EXCLUDED.origin_required,
  destination_required = EXCLUDED.destination_required,
  vehicle_brand_required = EXCLUDED.vehicle_brand_required,
  vehicle_model_required = EXCLUDED.vehicle_model_required,
  license_plate_required = EXCLUDED.license_plate_required,
  purchase_order_required = EXCLUDED.purchase_order_required,
  vehicle_info_optional = EXCLUDED.vehicle_info_optional,
  updated_at = now();

-- Create trigger to prevent excess of excess
CREATE OR REPLACE FUNCTION public.prevent_excess_of_excess()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent creating excess service from another excess service
  IF NEW.service_relationship_type = 'excess' AND NEW.related_service_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.services 
      WHERE id = NEW.related_service_id 
      AND service_relationship_type = 'excess'
    ) THEN
      RAISE EXCEPTION 'No se puede crear un excedente de un servicio que ya es excedente';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_excess_of_excess_trigger ON public.services;
CREATE TRIGGER prevent_excess_of_excess_trigger
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_excess_of_excess();

-- Create view for services with excess summary
CREATE OR REPLACE VIEW public.services_with_excess_summary AS
SELECT 
  s.id,
  s.folio,
  s.client_id,
  s.service_date,
  s.value,
  s.client_covered_amount,
  s.has_excess,
  s.service_relationship_type,
  s.related_service_id,
  c.name as client_name,
  -- Related service info
  rs.id as related_service_id_actual,
  rs.folio as related_service_folio,
  rs.client_id as related_client_id,
  rs.value as related_service_value,
  rc.name as related_client_name,
  -- Calculate excess amount
  CASE 
    WHEN s.has_excess = true AND s.client_covered_amount IS NOT NULL 
    THEN s.value - s.client_covered_amount
    ELSE 0
  END as calculated_excess_amount
FROM public.services s
LEFT JOIN public.clients c ON s.client_id = c.id
LEFT JOIN public.services rs ON s.related_service_id = rs.id
LEFT JOIN public.clients rc ON rs.client_id = rc.id
WHERE s.has_excess = true OR s.service_relationship_type IN ('main', 'excess');