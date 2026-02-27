-- 1. Remove invoice-service relationships
DELETE FROM public.invoice_services WHERE invoice_id = 'e4e9926d-e17f-43cd-8af7-80ee90b3440f';

-- 2. Delete the invoice FACT-4298
DELETE FROM public.invoices WHERE id = 'e4e9926d-e17f-43cd-8af7-80ee90b3440f';

-- 3. Clear invoice_folio from the 11 services (triggers will auto-fix status)
UPDATE public.services
SET invoice_folio = NULL, updated_at = now()
WHERE id IN (
  '2cf94784-46e9-48a6-86aa-bdb632a04e4a',
  '07fe4f09-e97e-4c79-b6c6-cd70e199a4e4',
  '863dd8ac-0346-4a0e-9c54-0ec8442d82ca',
  'e351f2f2-6e86-4909-a224-40921d8b09e6',
  'b460cfe6-5449-4cf2-9741-92af24feff7f',
  'be48c4cd-e5d3-408c-89bf-1cfbadd1ed66',
  '9849d501-51c1-4d55-b341-b980e2aa0b7f',
  'e85e582f-11d5-4d83-9e11-c98bebf06aba',
  '8aa894ac-b763-4dbc-b119-e58acafcbcea',
  '080c470c-6600-451d-b409-8c083d8e4e7d',
  '065e01ed-b25b-4b3f-9a75-a95ea8d76bbe'
);

-- 4. Force status back to with_purchase_order
UPDATE public.services
SET status = 'with_purchase_order', updated_at = now()
WHERE id IN (
  '2cf94784-46e9-48a6-86aa-bdb632a04e4a',
  '07fe4f09-e97e-4c79-b6c6-cd70e199a4e4',
  '863dd8ac-0346-4a0e-9c54-0ec8442d82ca',
  'e351f2f2-6e86-4909-a224-40921d8b09e6',
  'b460cfe6-5449-4cf2-9741-92af24feff7f',
  'be48c4cd-e5d3-408c-89bf-1cfbadd1ed66',
  '9849d501-51c1-4d55-b341-b980e2aa0b7f',
  'e85e582f-11d5-4d83-9e11-c98bebf06aba',
  '8aa894ac-b763-4dbc-b119-e58acafcbcea',
  '080c470c-6600-451d-b409-8c083d8e4e7d',
  '065e01ed-b25b-4b3f-9a75-a95ea8d76bbe'
);