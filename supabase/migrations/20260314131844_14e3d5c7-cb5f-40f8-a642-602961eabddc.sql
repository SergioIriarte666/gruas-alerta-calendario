
-- Fix trigger 1: auto_update_service_invoice_status
-- Only revert to 'completed' when current status IS 'invoiced' and folio is removed
CREATE OR REPLACE FUNCTION public.auto_update_service_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- When invoice_folio is added and status allows transition to invoiced
  IF NEW.invoice_folio IS NOT NULL AND NEW.invoice_folio != '' 
     AND (OLD.invoice_folio IS NULL OR OLD.invoice_folio = '') THEN
    IF NEW.status IN ('completed', 'failed') THEN
      NEW.status := 'invoiced';
    END IF;
  END IF;

  -- When invoice_folio is removed, only revert if currently invoiced
  IF (NEW.invoice_folio IS NULL OR NEW.invoice_folio = '') 
     AND (OLD.invoice_folio IS NOT NULL AND OLD.invoice_folio != '') THEN
    IF NEW.status = 'invoiced' THEN
      NEW.status := 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix trigger 2: validate_service_invoice_consistency
-- Allow post-service states to coexist with or without invoice_folio
CREATE OR REPLACE FUNCTION public.validate_service_invoice_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If status is 'invoiced' but no folio, revert to completed
  IF NEW.status = 'invoiced' AND (NEW.invoice_folio IS NULL OR NEW.invoice_folio = '') THEN
    NEW.status := 'completed';
  END IF;

  -- Do NOT force status to 'invoiced' just because invoice_folio exists.
  -- Post-service states (quoted, purchase_order_pending, with_purchase_order, completed, failed)
  -- are all valid even with an invoice_folio present.

  RETURN NEW;
END;
$$;
