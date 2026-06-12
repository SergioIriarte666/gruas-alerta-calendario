CREATE OR REPLACE FUNCTION public.update_invoice_status_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_total numeric(10,2);
  v_invoice_paid numeric(10,2);
  v_new_status public.invoice_status;
  v_invoice_id uuid;
  v_last_payment_date date;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT total
  INTO v_invoice_total
  FROM public.invoices
  WHERE id = v_invoice_id;

  SELECT
    COALESCE(SUM(pa.applied_amount), 0),
    MAX(p.payment_date)
  INTO v_invoice_paid, v_last_payment_date
  FROM public.payment_applications pa
  LEFT JOIN public.payments p ON p.id = pa.payment_id
  WHERE pa.invoice_id = v_invoice_id;

  IF v_invoice_paid = 0 THEN
    RETURN COALESCE(NEW, OLD);
  ELSIF v_invoice_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  UPDATE public.invoices
  SET
    paid_amount = v_invoice_paid,
    status = v_new_status,
    payment_date = CASE
      WHEN v_invoice_paid >= v_invoice_total THEN COALESCE(v_last_payment_date, payment_date, CURRENT_DATE)
      ELSE payment_date
    END,
    updated_at = now()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

UPDATE public.invoices i
SET
  payment_date = payments_summary.last_payment_date,
  updated_at = now()
FROM (
  SELECT
    pa.invoice_id,
    MAX(p.payment_date) AS last_payment_date
  FROM public.payment_applications pa
  JOIN public.payments p ON p.id = pa.payment_id
  GROUP BY pa.invoice_id
) AS payments_summary
WHERE i.id = payments_summary.invoice_id
  AND i.status = 'paid'
  AND payments_summary.last_payment_date IS NOT NULL
  AND i.payment_date IS DISTINCT FROM payments_summary.last_payment_date;
