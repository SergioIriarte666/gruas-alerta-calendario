-- Cost classification hardening:
-- - Add structured fields to costs for documents/location/other reason
-- - Add rule flags to cost_subcategories to drive UI validations and routing
-- - Seed/adjust "Gastos de Servicios" subcategories to cover recurrent operational cases

ALTER TABLE public.costs
ADD COLUMN IF NOT EXISTS document_type text,
ADD COLUMN IF NOT EXISTS document_number text,
ADD COLUMN IF NOT EXISTS location_text text,
ADD COLUMN IF NOT EXISTS other_reason text;

ALTER TABLE public.cost_subcategories
ADD COLUMN IF NOT EXISTS requires_crane boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_operator boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_supplier boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_document boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_location boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_other_reason boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS routes_to_inventory boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS other_reasons jsonb;

DO $$
DECLARE
  v_service_cat_id uuid;
BEGIN
  SELECT id INTO v_service_cat_id
  FROM public.cost_categories
  WHERE name = 'Gastos de Servicios'
  LIMIT 1;

  IF v_service_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories (category_id, name, display_order, is_active)
    SELECT v_service_cat_id, sub.name, sub.ord, true
    FROM (VALUES
      ('Carga y Descarga', 9),
      ('Subcontrato / Terceros', 10),
      ('Pago Operadores 3ros.', 11)
    ) AS sub(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories
      WHERE category_id = v_service_cat_id AND name = sub.name
    );
  END IF;
END $$;

UPDATE public.cost_subcategories cs
SET
  requires_crane = true
FROM public.cost_categories cc
WHERE cs.category_id = cc.id
  AND cc.name = 'Gastos de Servicios'
  AND cs.name = 'Combustible';

UPDATE public.cost_subcategories cs
SET
  requires_location = true
FROM public.cost_categories cc
WHERE cs.category_id = cc.id
  AND cc.name = 'Gastos de Servicios'
  AND cs.name IN ('Peajes', 'Estacionamiento');

UPDATE public.cost_subcategories cs
SET
  requires_operator = true
FROM public.cost_categories cc
WHERE cs.category_id = cc.id
  AND cc.name = 'Gastos de Servicios'
  AND cs.name IN ('Viáticos', 'Transporte', 'Hospedaje');

UPDATE public.cost_subcategories cs
SET
  requires_supplier = true,
  requires_document = true
FROM public.cost_categories cc
WHERE cs.category_id = cc.id
  AND cc.name = 'Gastos de Servicios'
  AND cs.name IN ('Carga y Descarga', 'Subcontrato / Terceros', 'Pago Operadores 3ros.');

UPDATE public.cost_subcategories
SET
  requires_other_reason = true,
  other_reasons = COALESCE(other_reasons, jsonb_build_array(
    'Error de proveedor / documento pendiente',
    'Gasto extraordinario no recurrente',
    'Ajuste / regularización',
    'Diferencia de caja / vuelto',
    'Otro (justificar)'
  ))
WHERE name = 'Otros';
