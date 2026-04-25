
-- =========================================================
-- 1) COST CHANGE HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cost_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_id UUID NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE','UPDATE','DELETE','SNAPSHOT')),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_summary TEXT,
  change_context TEXT
);
CREATE INDEX IF NOT EXISTS idx_cch_cost_id ON public.cost_change_history(cost_id);
CREATE INDEX IF NOT EXISTS idx_cch_changed_at ON public.cost_change_history(changed_at DESC);

ALTER TABLE public.cost_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cch_select_authenticated ON public.cost_change_history;
CREATE POLICY cch_select_authenticated ON public.cost_change_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cch_no_direct_insert ON public.cost_change_history;
CREATE POLICY cch_no_direct_insert ON public.cost_change_history
  FOR INSERT TO authenticated WITH CHECK (false);

-- =========================================================
-- 2) INVENTORY MOVEMENT CHANGE HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.inventory_movement_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_id UUID NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE','UPDATE','DELETE','SNAPSHOT')),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_summary TEXT,
  change_context TEXT
);
CREATE INDEX IF NOT EXISTS idx_imch_movement_id ON public.inventory_movement_change_history(movement_id);
CREATE INDEX IF NOT EXISTS idx_imch_changed_at ON public.inventory_movement_change_history(changed_at DESC);

ALTER TABLE public.inventory_movement_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS imch_select_authenticated ON public.inventory_movement_change_history;
CREATE POLICY imch_select_authenticated ON public.inventory_movement_change_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS imch_no_direct_insert ON public.inventory_movement_change_history;
CREATE POLICY imch_no_direct_insert ON public.inventory_movement_change_history
  FOR INSERT TO authenticated WITH CHECK (false);

-- =========================================================
-- 3) CRANE PART CHANGE HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.crane_part_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crane_part_id UUID NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE','UPDATE','DELETE','SNAPSHOT')),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_summary TEXT,
  change_context TEXT
);
CREATE INDEX IF NOT EXISTS idx_cpch_part_id ON public.crane_part_change_history(crane_part_id);
CREATE INDEX IF NOT EXISTS idx_cpch_changed_at ON public.crane_part_change_history(changed_at DESC);

ALTER TABLE public.crane_part_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cpch_select_authenticated ON public.crane_part_change_history;
CREATE POLICY cpch_select_authenticated ON public.crane_part_change_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cpch_no_direct_insert ON public.crane_part_change_history;
CREATE POLICY cpch_no_direct_insert ON public.crane_part_change_history
  FOR INSERT TO authenticated WITH CHECK (false);

-- =========================================================
-- 4) TRIGGER FUNCTION: COSTS
-- =========================================================
CREATE OR REPLACE FUNCTION public.track_cost_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (
      NEW.id,
      COALESCE(uid, NEW.created_by),
      'CREATE',
      'registro',
      NEW.description,
      'Costo creado: ' || COALESCE(NEW.description, '(sin descripción)') || ' por $' || COALESCE(NEW.amount::TEXT, '0')
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'amount', OLD.amount::TEXT, NEW.amount::TEXT,
        'Monto cambió de $' || OLD.amount || ' a $' || NEW.amount);
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'description', OLD.description, NEW.description,
        'Descripción actualizada');
    END IF;
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'date', OLD.date::TEXT, NEW.date::TEXT,
        'Fecha cambió de ' || OLD.date || ' a ' || NEW.date);
    END IF;
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'category_id', OLD.category_id::TEXT, NEW.category_id::TEXT, 'Categoría cambiada');
    END IF;
    IF NEW.subcategory IS DISTINCT FROM OLD.subcategory THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'subcategory', OLD.subcategory, NEW.subcategory, 'Subcategoría cambiada');
    END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier_id', OLD.supplier_id::TEXT, NEW.supplier_id::TEXT, 'Proveedor cambiado');
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada');
    END IF;
    IF NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'operator_id', OLD.operator_id::TEXT, NEW.operator_id::TEXT, 'Operador cambiado');
    END IF;
    IF NEW.payment_date IS DISTINCT FROM OLD.payment_date THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'payment_date', OLD.payment_date::TEXT, NEW.payment_date::TEXT,
        CASE WHEN OLD.payment_date IS NULL AND NEW.payment_date IS NOT NULL THEN 'Marcado como pagado el ' || NEW.payment_date
             WHEN OLD.payment_date IS NOT NULL AND NEW.payment_date IS NULL THEN 'Marcado como NO pagado'
             ELSE 'Fecha de pago cambió de ' || OLD.payment_date || ' a ' || NEW.payment_date END);
    END IF;
    IF NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'document_number', OLD.document_number, NEW.document_number, 'N° documento actualizado');
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'notes', OLD.notes, NEW.notes, 'Notas actualizadas');
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.description,
      'Costo eliminado: ' || COALESCE(OLD.description, '(sin descripción)') || ' por $' || COALESCE(OLD.amount::TEXT, '0'));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_track_cost_changes ON public.costs;
CREATE TRIGGER trigger_track_cost_changes
AFTER INSERT OR UPDATE OR DELETE ON public.costs
FOR EACH ROW EXECUTE FUNCTION public.track_cost_changes();

-- =========================================================
-- 5) TRIGGER FUNCTION: INVENTORY_MOVEMENTS
-- =========================================================
CREATE OR REPLACE FUNCTION public.track_inventory_movement_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, COALESCE(uid, NEW.created_by), 'CREATE', 'registro', NEW.movement_type,
      'Movimiento creado: ' || NEW.movement_type || ' x' || NEW.quantity);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'quantity', OLD.quantity::TEXT, NEW.quantity::TEXT,
        'Cantidad cambió de ' || OLD.quantity || ' a ' || NEW.quantity);
    END IF;
    IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'unit_cost', OLD.unit_cost::TEXT, NEW.unit_cost::TEXT,
        'Costo unitario cambió de $' || COALESCE(OLD.unit_cost::TEXT,'0') || ' a $' || COALESCE(NEW.unit_cost::TEXT,'0'));
    END IF;
    IF NEW.total_cost IS DISTINCT FROM OLD.total_cost THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'total_cost', OLD.total_cost::TEXT, NEW.total_cost::TEXT, 'Costo total actualizado');
    END IF;
    IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'location_id', OLD.location_id::TEXT, NEW.location_id::TEXT, 'Ubicación cambiada');
    END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier_id', OLD.supplier_id::TEXT, NEW.supplier_id::TEXT, 'Proveedor cambiado');
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'status', OLD.status, NEW.status, 'Estado cambió de ' || OLD.status || ' a ' || NEW.status);
    END IF;
    IF NEW.observations IS DISTINCT FROM OLD.observations THEN
      INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'observations', OLD.observations, NEW.observations, 'Observaciones actualizadas');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.movement_type,
      'Movimiento eliminado: ' || OLD.movement_type || ' x' || OLD.quantity);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_track_inventory_movement_changes ON public.inventory_movements;
CREATE TRIGGER trigger_track_inventory_movement_changes
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.track_inventory_movement_changes();

-- =========================================================
-- 6) TRIGGER FUNCTION: CRANE_PARTS
-- =========================================================
CREATE OR REPLACE FUNCTION public.track_crane_part_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, COALESCE(uid, NEW.created_by), 'CREATE', 'registro', NEW.part_name,
      'Repuesto registrado: ' || NEW.part_name || ' x' || NEW.quantity || ' a $' || NEW.unit_price);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.part_name IS DISTINCT FROM OLD.part_name THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'part_name', OLD.part_name, NEW.part_name, 'Nombre del repuesto actualizado');
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'quantity', OLD.quantity::TEXT, NEW.quantity::TEXT,
        'Cantidad cambió de ' || OLD.quantity || ' a ' || NEW.quantity);
    END IF;
    IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'unit_price', OLD.unit_price::TEXT, NEW.unit_price::TEXT,
        'Precio unitario cambió de $' || OLD.unit_price || ' a $' || NEW.unit_price);
    END IF;
    IF NEW.supplier IS DISTINCT FROM OLD.supplier THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'supplier', OLD.supplier, NEW.supplier, 'Proveedor cambiado');
    END IF;
    IF NEW.crane_id IS DISTINCT FROM OLD.crane_id THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'crane_id', OLD.crane_id::TEXT, NEW.crane_id::TEXT, 'Grúa cambiada');
    END IF;
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'date', OLD.date::TEXT, NEW.date::TEXT, 'Fecha cambió de ' || OLD.date || ' a ' || NEW.date);
    END IF;
    IF NEW.kilometraje IS DISTINCT FROM OLD.kilometraje THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'kilometraje', OLD.kilometraje::TEXT, NEW.kilometraje::TEXT, 'Kilometraje actualizado');
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, new_value, change_summary)
      VALUES (NEW.id, uid, 'UPDATE', 'notes', OLD.notes, NEW.notes, 'Notas actualizadas');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, uid, 'DELETE', 'registro', OLD.part_name,
      'Repuesto eliminado: ' || OLD.part_name || ' x' || OLD.quantity);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_track_crane_part_changes ON public.crane_parts;
CREATE TRIGGER trigger_track_crane_part_changes
AFTER INSERT OR UPDATE OR DELETE ON public.crane_parts
FOR EACH ROW EXECUTE FUNCTION public.track_crane_part_changes();

-- =========================================================
-- 7) BACKFILL SNAPSHOTS (estado inicial de registros existentes)
-- =========================================================
INSERT INTO public.cost_change_history (cost_id, changed_by, change_type, field_name, new_value, change_summary, changed_at)
SELECT c.id, c.created_by, 'SNAPSHOT', 'estado_inicial', c.description,
  'Estado inicial registrado: ' || COALESCE(c.description,'(sin descripción)') || ' por $' || COALESCE(c.amount::TEXT,'0'),
  c.created_at
FROM public.costs c
WHERE NOT EXISTS (SELECT 1 FROM public.cost_change_history h WHERE h.cost_id = c.id);

INSERT INTO public.inventory_movement_change_history (movement_id, changed_by, change_type, field_name, new_value, change_summary, changed_at)
SELECT m.id, m.created_by, 'SNAPSHOT', 'estado_inicial', m.movement_type,
  'Estado inicial registrado: ' || m.movement_type || ' x' || m.quantity,
  m.created_at
FROM public.inventory_movements m
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_movement_change_history h WHERE h.movement_id = m.id);

INSERT INTO public.crane_part_change_history (crane_part_id, changed_by, change_type, field_name, new_value, change_summary, changed_at)
SELECT p.id, p.created_by, 'SNAPSHOT', 'estado_inicial', p.part_name,
  'Estado inicial registrado: ' || p.part_name || ' x' || p.quantity || ' a $' || p.unit_price,
  p.created_at
FROM public.crane_parts p
WHERE NOT EXISTS (SELECT 1 FROM public.crane_part_change_history h WHERE h.crane_part_id = p.id);
