-- Part 1: Fix existing data - update invoice_folio for services in invoiced closures
UPDATE services s
SET 
  invoice_folio = i.folio,
  invoice_numero_fiscal = i.numero_fiscal,
  status = 'invoiced',
  updated_at = now()
FROM closure_services cs
JOIN invoice_closures ic ON ic.closure_id = cs.closure_id
JOIN invoices i ON i.id = ic.invoice_id
WHERE cs.service_id = s.id
  AND (s.invoice_folio IS NULL OR s.invoice_folio = '');

-- Part 2: Create trigger to automatically propagate invoice_folio to closure services
CREATE OR REPLACE FUNCTION propagate_invoice_folio_to_closure_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update all services in the closure with the invoice folio
  UPDATE services s
  SET 
    invoice_folio = (SELECT folio FROM invoices WHERE id = NEW.invoice_id),
    invoice_numero_fiscal = (SELECT numero_fiscal FROM invoices WHERE id = NEW.invoice_id),
    status = 'invoiced',
    updated_at = now()
  FROM closure_services cs
  WHERE cs.closure_id = NEW.closure_id
    AND cs.service_id = s.id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS propagate_invoice_folio_trigger ON invoice_closures;

-- Create the trigger
CREATE TRIGGER propagate_invoice_folio_trigger
AFTER INSERT ON invoice_closures
FOR EACH ROW
EXECUTE FUNCTION propagate_invoice_folio_to_closure_services();