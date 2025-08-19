-- CORREGIR FUNCIÓN DE GENERACIÓN DE FOLIOS DE FACTURAS
-- Problema: UPDATE sin WHERE clause
-- ========================================================

-- Eliminar función defectuosa
DROP FUNCTION IF EXISTS public.generate_unique_invoice_folio();

-- Crear función corregida con WHERE clause
CREATE OR REPLACE FUNCTION public.generate_unique_invoice_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_folio TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- Obtener y actualizar el siguiente número con WHERE clause
    UPDATE public.company_data 
    SET next_service_folio_number = next_service_folio_number + 1
    WHERE id = (SELECT id FROM public.company_data LIMIT 1)
    RETURNING next_service_folio_number - 1 INTO next_number;
    
    -- Si no se actualizó nada, usar número por defecto
    IF next_number IS NULL THEN
      next_number := 1000;
      INSERT INTO public.company_data (business_name, rut, address, phone, email, next_service_folio_number) 
      VALUES ('Empresa', '12345678-9', 'Dirección', '123456789', 'email@empresa.com', 1001)
      ON CONFLICT (id) DO UPDATE SET next_service_folio_number = 1001;
    END IF;
    
    -- Generar el folio
    new_folio := 'FACT-' || LPAD(next_number::text, 3, '0');
    
    -- Verificar que no existe
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE folio = new_folio) THEN
      RETURN new_folio;
    END IF;
    
    -- Control de intentos
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'No se pudo generar un folio único después de % intentos', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Verificar que hay datos en company_data
INSERT INTO public.company_data (business_name, rut, address, phone, email, next_service_folio_number) 
VALUES ('TMS Gruas', '12345678-9', 'Dirección Principal', '123456789', 'contacto@tmsgruas.com', 1000)
ON CONFLICT (id) DO NOTHING;

-- Sincronizar contador con facturas existentes
UPDATE public.company_data 
SET next_service_folio_number = GREATEST(
  next_service_folio_number,
  COALESCE((
    SELECT MAX(CAST(SUBSTRING(folio FROM '[0-9]+') AS INTEGER)) + 1
    FROM public.invoices 
    WHERE folio ~ '^FACT-[0-9]+$'
  ), 1000)
)
WHERE id = (SELECT id FROM public.company_data LIMIT 1);