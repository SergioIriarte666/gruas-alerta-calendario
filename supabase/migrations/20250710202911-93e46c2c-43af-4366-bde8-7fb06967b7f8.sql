-- Create crane_parts table for managing spare parts and pieces
CREATE TABLE public.crane_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crane_id UUID NOT NULL,
  date DATE NOT NULL,
  supplier TEXT NOT NULL,
  phone TEXT,
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price > 0),
  total_value NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  cost_id UUID, -- Reference to the associated cost record
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable Row Level Security
ALTER TABLE public.crane_parts ENABLE ROW LEVEL SECURITY;

-- Create policies for crane parts
CREATE POLICY "crane_parts_select_policy" 
ON public.crane_parts 
FOR SELECT 
USING (is_operator_user());

CREATE POLICY "crane_parts_modify_policy" 
ON public.crane_parts 
FOR ALL 
USING (is_admin_user());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_crane_parts_updated_at
BEFORE UPDATE ON public.crane_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create cost entry when adding crane part
CREATE OR REPLACE FUNCTION public.create_cost_for_crane_part()
RETURNS TRIGGER AS $$
DECLARE
  maintenance_category_id UUID;
  new_cost_id UUID;
BEGIN
  -- Get the maintenance category ID
  SELECT id INTO maintenance_category_id
  FROM public.cost_categories
  WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%maintenance%'
  LIMIT 1;

  -- If no maintenance category exists, create one
  IF maintenance_category_id IS NULL THEN
    INSERT INTO public.cost_categories (name, description)
    VALUES ('Mantenimiento', 'Gastos de mantenimiento y reparaciones')
    RETURNING id INTO maintenance_category_id;
  END IF;

  -- Create cost entry
  INSERT INTO public.costs (
    amount,
    category_id,
    crane_id,
    date,
    description,
    notes,
    subcategory,
    created_by
  ) VALUES (
    NEW.total_value,
    maintenance_category_id,
    NEW.crane_id,
    NEW.date,
    'Compra de piezas: ' || NEW.part_name,
    COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    'Piezas y Repuestos',
    NEW.created_by
  ) RETURNING id INTO new_cost_id;

  -- Update the crane_part with the cost_id reference
  NEW.cost_id := new_cost_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update cost entry when updating crane part
CREATE OR REPLACE FUNCTION public.update_cost_for_crane_part()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the associated cost record
  UPDATE public.costs
  SET 
    amount = NEW.total_value,
    date = NEW.date,
    description = 'Compra de piezas: ' || NEW.part_name,
    notes = COALESCE(NEW.notes, '') || ' - Proveedor: ' || NEW.supplier || CASE WHEN NEW.phone IS NOT NULL THEN ' (Tel: ' || NEW.phone || ')' ELSE '' END,
    updated_at = now()
  WHERE id = NEW.cost_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to delete cost entry when deleting crane part
CREATE OR REPLACE FUNCTION public.delete_cost_for_crane_part()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the associated cost record
  DELETE FROM public.costs WHERE id = OLD.cost_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic cost management
CREATE TRIGGER crane_parts_create_cost
  BEFORE INSERT ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_for_crane_part();

CREATE TRIGGER crane_parts_update_cost
  AFTER UPDATE ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cost_for_crane_part();

CREATE TRIGGER crane_parts_delete_cost
  BEFORE DELETE ON public.crane_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_cost_for_crane_part();

-- Add foreign key constraints
ALTER TABLE public.crane_parts 
ADD CONSTRAINT crane_parts_crane_id_fkey 
FOREIGN KEY (crane_id) REFERENCES public.cranes(id) ON DELETE CASCADE;

ALTER TABLE public.crane_parts 
ADD CONSTRAINT crane_parts_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- Create indexes for better performance
CREATE INDEX idx_crane_parts_crane_id ON public.crane_parts(crane_id);
CREATE INDEX idx_crane_parts_date ON public.crane_parts(date);
CREATE INDEX idx_crane_parts_supplier ON public.crane_parts(supplier);