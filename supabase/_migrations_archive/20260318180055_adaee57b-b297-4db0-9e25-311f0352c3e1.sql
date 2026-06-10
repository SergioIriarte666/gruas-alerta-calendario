-- Corregir todos los pagos marcados como 'paid' donde paid_amount no coincide con amount
UPDATE public.supplier_payments 
SET paid_amount = amount 
WHERE status = 'paid' AND (paid_amount IS NULL OR paid_amount != amount);