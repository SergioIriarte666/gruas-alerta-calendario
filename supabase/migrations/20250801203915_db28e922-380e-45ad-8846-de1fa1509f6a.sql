-- Fix invoice folio generation to avoid duplicates
CREATE OR REPLACE FUNCTION public.generate_unique_invoice_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  new_folio TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- Find the next available number by looking at the last invoice
    SELECT COALESCE(
      (SELECT CAST(SUBSTRING(folio FROM 'FACT-(\d+)') AS INTEGER) + 1
       FROM public.invoices 
       WHERE folio ~ '^FACT-\d+$'
       ORDER BY CAST(SUBSTRING(folio FROM 'FACT-(\d+)') AS INTEGER) DESC
       LIMIT 1), 
      1
    ) INTO next_number;
    
    -- Generate the folio
    new_folio := 'FACT-' || LPAD(next_number::text, 3, '0');
    
    -- Check if it exists
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE folio = new_folio) THEN
      RETURN new_folio;
    END IF;
    
    -- If it exists, try with next number
    next_number := next_number + 1;
    attempt := attempt + 1;
    
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'No se pudo generar un folio único después de % intentos', max_attempts;
    END IF;
  END LOOP;
END;
$function$;