-- Agregar campos para fecha real de pago de comisiones
-- Esto permite mantener la fecha de generación original y registrar cuándo se pagó realmente

-- Agregar campos a la tabla costs para fecha de pago real
ALTER TABLE public.costs 
ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT NULL;

ALTER TABLE public.costs 
ADD COLUMN IF NOT EXISTS payment_batch_id TEXT DEFAULT NULL;

-- Crear índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_costs_payment_date ON public.costs(payment_date) WHERE payment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_costs_payment_batch ON public.costs(payment_batch_id) WHERE payment_batch_id IS NOT NULL;

-- Actualizar función get_commissions_with_details para incluir fecha de pago
CREATE OR REPLACE FUNCTION public.get_commissions_with_details()
 RETURNS TABLE(
   id uuid,
   date date,
   payment_date date,
   payment_batch_id text,
   description text,
   amount numeric,
   operator_id uuid,
   service_id uuid,
   service_folio text,
   subcategory text,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   operator_name text,
   operator_rut text,
   service_date date,
   service_value numeric,
   client_name text,
   commission_percentage numeric
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.date,
    c.payment_date,
    c.payment_batch_id,
    c.description,
    c.amount,
    c.operator_id,
    c.service_id,
    c.service_folio,
    c.subcategory,
    c.created_at,
    c.updated_at,
    o.name as operator_name,
    o.rut as operator_rut,
    s.service_date,
    s.value as service_value,
    cl.name as client_name,
    CASE 
      WHEN s.value > 0 AND c.amount > 0 THEN 
        ROUND((c.amount * 100.0 / s.value), 2)
      ELSE 0
    END as commission_percentage
  FROM public.costs c
  LEFT JOIN public.operators o ON c.operator_id = o.id
  LEFT JOIN public.services s ON c.service_id = s.id
  LEFT JOIN public.clients cl ON s.client_id = cl.id
  LEFT JOIN public.cost_categories cc ON c.category_id = cc.id
  WHERE cc.name = 'Comisión Operador'
    OR c.subcategory IN ('comisiones', 'comisiones_pagadas')
  ORDER BY c.date DESC, c.created_at DESC;
END;
$function$;

-- Crear comentarios para documentar el propósito
COMMENT ON COLUMN public.costs.payment_date IS 'Fecha real cuando se pagó la comisión (diferente de date que es la fecha de generación)';
COMMENT ON COLUMN public.costs.payment_batch_id IS 'Identificador del lote de pago para trazabilidad';
