INSERT INTO public.invoice_services (invoice_id, service_id)
SELECT DISTINCT ic.invoice_id, cs.service_id
FROM public.invoice_closures ic
JOIN public.closure_services cs ON cs.closure_id = ic.closure_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_services isv
   WHERE isv.invoice_id = ic.invoice_id
     AND isv.service_id = cs.service_id
);