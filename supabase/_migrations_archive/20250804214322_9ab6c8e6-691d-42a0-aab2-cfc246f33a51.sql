-- Arreglar función de generación de folio
CREATE OR REPLACE FUNCTION public.generate_service_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  folio_format TEXT;
  new_folio TEXT;
BEGIN
  -- Obtener configuración de la empresa con alias específicos
  SELECT cd.next_service_folio_number, COALESCE(cd.folio_format, 'SRV-{number}') 
  INTO next_number, folio_format
  FROM public.company_data cd 
  LIMIT 1;
  
  -- Si no existe configuración, crear una por defecto
  IF next_number IS NULL THEN
    INSERT INTO public.company_data (
      business_name, rut, address, phone, email, 
      next_service_folio_number, folio_format
    ) 
    VALUES (
      'Empresa', '12345678-9', 'Dirección', '123456789', 
      'email@empresa.com', 1001, 'SRV-{number}'
    )
    ON CONFLICT (id) DO UPDATE SET 
      next_service_folio_number = 1001,
      folio_format = 'SRV-{number}';
    
    next_number := 1000;
    folio_format := 'SRV-{number}';
  END IF;
  
  -- Incrementar el contador
  UPDATE public.company_data 
  SET next_service_folio_number = next_service_folio_number + 1
  WHERE id = (SELECT id FROM public.company_data LIMIT 1);
  
  -- Generar el folio usando el formato
  new_folio := REPLACE(folio_format, '{number}', LPAD(next_number::text, 4, '0'));
  
  RETURN new_folio;
END;
$function$;