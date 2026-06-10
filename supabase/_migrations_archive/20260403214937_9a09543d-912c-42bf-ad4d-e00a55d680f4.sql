
-- Delete the 3 duplicate supplier_payments first (FK constraint)
DELETE FROM public.supplier_payments 
WHERE id IN (
  '4d3354ed-9a0f-4388-b664-7b5791810d59',
  'ec41b1d1-0a28-4efe-9f44-e3081d3b4795',
  '6f64a73c-6fe6-45ab-859b-72bc9b403095'
);

-- Delete the 3 duplicate costs
DELETE FROM public.costs 
WHERE id IN (
  '3b0b229d-88e2-484f-93d6-db9fd2bedc87',
  '82630d4a-6672-4f9f-a785-f593df372b4c',
  '157ec93e-a879-4420-bc34-52d9c6c827ce'
);
