-- Delete orphaned/duplicate pending payment for MCM Ltda (FACT-4315 already paid via AUTO-FACT-4315)
DELETE FROM public.payments 
WHERE id = 'cf55ec3d-0487-404c-8a59-988a11e938b7' 
  AND status = 'pending' 
  AND applied_amount = 0;

-- Also clean up any other orphaned pending payments that are exact duplicates of applied ones
DELETE FROM public.payments p1
WHERE p1.status = 'pending'
  AND p1.applied_amount = 0
  AND EXISTS (
    SELECT 1 FROM public.payments p2
    WHERE p2.client_id = p1.client_id
      AND p2.amount = p1.amount
      AND p2.payment_date = p1.payment_date
      AND p2.status = 'applied'
      AND p2.id != p1.id
  );