UPDATE public.invoices
SET paid_amount = total,
    updated_at = now()
WHERE status = 'cancelled' AND paid_amount <> total;