-- Crear función para obtener comisiones con todos los datos relacionados
CREATE OR REPLACE FUNCTION public.get_commissions_with_details()
RETURNS TABLE (
  id UUID,
  date DATE,
  description TEXT,
  amount NUMERIC,
  operator_id UUID,
  service_id UUID,
  service_folio TEXT,
  subcategory TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  service_value NUMERIC,
  service_date DATE,
  client_name TEXT,
  operator_name TEXT,
  operator_rut TEXT
) 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.date,
    c.description,
    c.amount,
    c.operator_id,
    c.service_id,
    c.service_folio,
    c.subcategory,
    c.created_at,
    c.updated_at,
    s.value as service_value,
    s.service_date,
    cl.name as client_name,
    o.name as operator_name,
    o.rut as operator_rut
  FROM public.costs c
  LEFT JOIN public.services s ON c.service_id = s.id
  LEFT JOIN public.clients cl ON s.client_id = cl.id  
  LEFT JOIN public.operators o ON c.operator_id = o.id
  WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND c.operator_id IS NOT NULL
    AND (c.subcategory = 'comisiones' OR c.subcategory = 'comisiones_pagadas' OR c.subcategory IS NULL)
  ORDER BY c.created_at DESC;
END;
$$;