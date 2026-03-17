
-- FASE 1 DEFINITIVE: Unify suppliers into inventory_suppliers

-- 1. Add all missing columns
ALTER TABLE public.inventory_suppliers ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'otros';
ALTER TABLE public.inventory_suppliers ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE public.inventory_suppliers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.inventory_suppliers ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 2. Migrate ALL suppliers into inventory_suppliers (by RUT match)
INSERT INTO public.inventory_suppliers (name, rut, email, phone, address, contact_person, category, subcategory, notes, is_active, created_at, created_by)
SELECT s.name, s.rut::text, s.email::text, s.phone::text, s.address, s.contact_name,
       s.category::text, s.subcategory, s.notes, s.is_active, s.created_at, s.created_by
FROM public.suppliers s
WHERE s.rut IS NOT NULL AND TRIM(s.rut::text) != ''
AND NOT EXISTS (
  SELECT 1 FROM public.inventory_suppliers inv 
  WHERE UPPER(REPLACE(REPLACE(REPLACE(COALESCE(inv.rut,''), '.', ''), '-', ''), ' ', ''))
      = UPPER(REPLACE(REPLACE(REPLACE(s.rut::text, '.', ''), '-', ''), ' ', ''))
  AND UPPER(REPLACE(REPLACE(REPLACE(s.rut::text, '.', ''), '-', ''), ' ', '')) != ''
);

-- 2b. Migrate suppliers without RUT (by name match)
INSERT INTO public.inventory_suppliers (name, rut, email, phone, address, contact_person, category, subcategory, notes, is_active, created_at, created_by)
SELECT s.name, s.rut::text, s.email::text, s.phone::text, s.address, s.contact_name,
       s.category::text, s.subcategory, s.notes, s.is_active, s.created_at, s.created_by
FROM public.suppliers s
WHERE (s.rut IS NULL OR TRIM(s.rut::text) = '')
AND NOT EXISTS (
  SELECT 1 FROM public.inventory_suppliers inv WHERE LOWER(TRIM(inv.name)) = LOWER(TRIM(s.name))
);

-- 3. Enrich existing inventory_suppliers with data from suppliers
UPDATE public.inventory_suppliers inv SET 
  category = CASE WHEN inv.category = 'otros' AND s.category::text != 'otros' THEN s.category::text ELSE inv.category END,
  subcategory = COALESCE(inv.subcategory, s.subcategory),
  notes = COALESCE(inv.notes, s.notes),
  contact_person = COALESCE(inv.contact_person, s.contact_name),
  email = COALESCE(inv.email, s.email::text),
  phone = COALESCE(inv.phone, s.phone::text),
  address = COALESCE(inv.address, s.address)
FROM public.suppliers s
WHERE UPPER(REPLACE(REPLACE(REPLACE(COALESCE(inv.rut,''), '.', ''), '-', ''), ' ', ''))
    = UPPER(REPLACE(REPLACE(REPLACE(s.rut::text, '.', ''), '-', ''), ' ', ''))
AND UPPER(REPLACE(REPLACE(REPLACE(s.rut::text, '.', ''), '-', ''), ' ', '')) != '';

-- 4. Drop all old FK constraints pointing to suppliers
ALTER TABLE public.costs DROP CONSTRAINT IF EXISTS costs_supplier_id_fkey;
ALTER TABLE public.crane_parts DROP CONSTRAINT IF EXISTS crane_parts_supplier_id_fkey;
ALTER TABLE public.creditors DROP CONSTRAINT IF EXISTS creditors_supplier_id_fkey;
ALTER TABLE public.supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_supplier_id_fkey;
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_supplier_id_fkey;

-- 5. Build comprehensive mapping
CREATE TEMP TABLE supplier_id_mapping AS
SELECT DISTINCT ON (s.id) s.id AS old_id, inv.id AS new_id
FROM public.suppliers s
JOIN public.inventory_suppliers inv 
  ON UPPER(REPLACE(REPLACE(REPLACE(COALESCE(inv.rut,''), '.', ''), '-', ''), ' ', ''))
   = UPPER(REPLACE(REPLACE(REPLACE(s.rut::text, '.', ''), '-', ''), ' ', ''))
  AND UPPER(REPLACE(REPLACE(REPLACE(s.rut::text, '.', ''), '-', ''), ' ', '')) != '';

INSERT INTO supplier_id_mapping (old_id, new_id)
SELECT DISTINCT ON (s.id) s.id, inv.id
FROM public.suppliers s
JOIN public.inventory_suppliers inv ON LOWER(TRIM(inv.name)) = LOWER(TRIM(s.name))
WHERE s.id NOT IN (SELECT old_id FROM supplier_id_mapping);

-- 6. Remap all dependent tables
UPDATE public.costs c SET supplier_id = m.new_id FROM supplier_id_mapping m WHERE c.supplier_id = m.old_id;
UPDATE public.crane_parts cp SET supplier_id = m.new_id FROM supplier_id_mapping m WHERE cp.supplier_id = m.old_id;
UPDATE public.creditors cr SET supplier_id = m.new_id FROM supplier_id_mapping m WHERE cr.supplier_id = m.old_id;
UPDATE public.supplier_payments sp SET supplier_id = m.new_id FROM supplier_id_mapping m WHERE sp.supplier_id = m.old_id;
UPDATE public.inventory_movements im SET supplier_id = m.new_id FROM supplier_id_mapping m WHERE im.supplier_id = m.old_id;

-- 7. Handle orphans: null out nullable columns, skip NOT NULL columns
UPDATE public.costs SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM public.inventory_suppliers);
UPDATE public.crane_parts SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM public.inventory_suppliers);
UPDATE public.creditors SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM public.inventory_suppliers);
UPDATE public.inventory_movements SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM public.inventory_suppliers);

-- For supplier_payments (NOT NULL): allow NULL temporarily, clean, then restore
ALTER TABLE public.supplier_payments ALTER COLUMN supplier_id DROP NOT NULL;
UPDATE public.supplier_payments SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM public.inventory_suppliers);

-- 8. Create new FKs pointing to inventory_suppliers
ALTER TABLE public.costs ADD CONSTRAINT costs_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id);
ALTER TABLE public.crane_parts ADD CONSTRAINT crane_parts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id);
ALTER TABLE public.creditors ADD CONSTRAINT creditors_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id);
ALTER TABLE public.supplier_payments ADD CONSTRAINT supplier_payments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id);
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id);

DROP TABLE IF EXISTS supplier_id_mapping;
