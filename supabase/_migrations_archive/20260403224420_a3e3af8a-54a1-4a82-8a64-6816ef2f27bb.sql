UPDATE public.inventory_movements AS im
SET
  reference_document = '389111',
  supplier_name = 'MGS Repuestos y Cia. Ltda.',
  movement_date = im.created_at
FROM public.supplier_invoices AS si
WHERE im.supplier_invoice_id = si.id
  AND si.invoice_number = '389111'
  AND im.movement_type = 'exit'
  AND im.status = 'active'
  AND (
    im.reference_document IS DISTINCT FROM '389111'
    OR im.supplier_name IS DISTINCT FROM 'MGS Repuestos y Cia. Ltda.'
    OR im.movement_date IS DISTINCT FROM im.created_at
  );