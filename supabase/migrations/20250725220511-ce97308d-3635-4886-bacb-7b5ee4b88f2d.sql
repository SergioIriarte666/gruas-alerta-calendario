-- SOLUCIONAR PROBLEMA DE FOLIOS DUPLICADOS EN FACTURAS
-- ========================================================

-- 1. Verificar state actual de folios
SELECT folio, COUNT(*) as count 
FROM public.invoices 
GROUP BY folio 
HAVING COUNT(*) > 1
ORDER BY folio;

-- 2. Verificar el siguiente número de folio en company_data
SELECT 
  folio_format,
  next_service_folio_number,
  (SELECT MAX(CAST(SUBSTRING(folio FROM '[0-9]+') AS INTEGER)) FROM public.invoices WHERE folio ~ '^FACT-[0-9]+$') as max_folio_number
FROM public.company_data;

-- 3. Limpiar factura de prueba que pueda estar causando conflicto
DELETE FROM public.invoices WHERE folio = 'TEST-001';

-- 4. Asegurar que el contador esté sincronizado correctamente
UPDATE public.company_data 
SET next_service_folio_number = GREATEST(
  next_service_folio_number,
  COALESCE((
    SELECT MAX(CAST(SUBSTRING(folio FROM '[0-9]+') AS INTEGER)) + 1
    FROM public.invoices 
    WHERE folio ~ '^FACT-[0-9]+$'
  ), 1000)
);

-- 5. Crear función mejorada para generar folios únicos para facturas
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
    -- Obtener y actualizar el siguiente número
    UPDATE public.company_data 
    SET next_service_folio_number = next_service_folio_number + 1
    RETURNING next_service_folio_number - 1 INTO next_number;
    
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

-- 6. Verificar el estado final
SELECT 
  'Estado después de la corrección:' as status,
  folio_format,
  next_service_folio_number,
  (SELECT COUNT(*) FROM public.invoices) as total_invoices,
  (SELECT MAX(folio) FROM public.invoices WHERE folio ~ '^FACT-[0-9]+$') as max_folio
FROM public.company_data;