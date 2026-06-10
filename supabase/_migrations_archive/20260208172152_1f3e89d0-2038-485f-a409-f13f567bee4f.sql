-- Fix duplicate supplier payment for reference_number 504448 (Arrendadora de Vehículos S.A.)
-- Goal: keep the original overdue record, migrate payment info + cost link from the newer duplicate, then remove the duplicate.

begin;

-- 1) Re-link any costs created for the duplicate payment to the original payment
update public.costs
set supplier_payment_id = '4a54484c-d091-4709-8b14-e6a14a630421'
where supplier_payment_id = 'f214893e-ae8e-49e2-b766-3906915235c5';

-- 2) Mark the original payment as paid using data from the duplicate
update public.supplier_payments
set
  status = 'paid',
  paid_date = '2026-02-08',
  paid_amount = 5280405,
  updated_at = now()
where id = '4a54484c-d091-4709-8b14-e6a14a630421';

-- 3) Remove the duplicate payment row
delete from public.supplier_payments
where id = 'f214893e-ae8e-49e2-b766-3906915235c5';

commit;