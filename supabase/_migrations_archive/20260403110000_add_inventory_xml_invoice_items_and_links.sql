DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'source_module'
  ) THEN
    ALTER TABLE public.supplier_invoices
      ADD COLUMN source_module text NOT NULL DEFAULT 'manual';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invoices'
      AND column_name = 'xml_file_name'
  ) THEN
    ALTER TABLE public.supplier_invoices
      ADD COLUMN xml_file_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'costs'
      AND column_name = 'supplier_invoice_id'
  ) THEN
    ALTER TABLE public.costs
      ADD COLUMN supplier_invoice_id uuid REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_costs_supplier_invoice_id
  ON public.costs(supplier_invoice_id);

CREATE TABLE IF NOT EXISTS public.supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  line_number integer NOT NULL,
  product_code text,
  product_name text,
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_rate numeric(8,4),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  movement_id uuid REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  UNIQUE (supplier_invoice_id, line_number)
);

ALTER TABLE public.supplier_invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoice_items'
      AND policyname = 'supplier_invoice_items_select_policy'
  ) THEN
    CREATE POLICY "supplier_invoice_items_select_policy"
      ON public.supplier_invoice_items
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_invoice_items'
      AND policyname = 'supplier_invoice_items_modify_policy'
  ) THEN
    CREATE POLICY "supplier_invoice_items_modify_policy"
      ON public.supplier_invoice_items
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_invoice_id
  ON public.supplier_invoice_items(supplier_invoice_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_inventory_item_id
  ON public.supplier_invoice_items(inventory_item_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_movements'
      AND column_name = 'supplier_invoice_id'
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD COLUMN supplier_invoice_id uuid REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_movements'
      AND column_name = 'supplier_invoice_item_id'
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD COLUMN supplier_invoice_item_id uuid REFERENCES public.supplier_invoice_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_supplier_invoice_id
  ON public.inventory_movements(supplier_invoice_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_supplier_invoice_item_id
  ON public.inventory_movements(supplier_invoice_item_id);

CREATE OR REPLACE FUNCTION public.touch_supplier_invoice_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supplier_invoice_items_touch_updated_at ON public.supplier_invoice_items;
CREATE TRIGGER supplier_invoice_items_touch_updated_at
  BEFORE UPDATE ON public.supplier_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_supplier_invoice_items_updated_at();
