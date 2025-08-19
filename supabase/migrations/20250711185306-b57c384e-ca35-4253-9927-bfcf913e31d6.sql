-- Create inventory categories table
CREATE TABLE public.inventory_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create inventory suppliers table
CREATE TABLE public.inventory_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  rut TEXT,
  payment_terms TEXT,
  delivery_time_days INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create inventory locations table
CREATE TABLE public.inventory_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  barcode TEXT,
  category_id UUID REFERENCES public.inventory_categories(id),
  unit_of_measure TEXT NOT NULL DEFAULT 'unidad',
  minimum_stock INTEGER DEFAULT 0,
  maximum_stock INTEGER DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  unit_cost NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_critical BOOLEAN DEFAULT false,
  has_expiration BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create inventory stock table
CREATE TABLE public.inventory_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id),
  current_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER GENERATED ALWAYS AS (current_quantity - reserved_quantity) STORED,
  last_movement_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, location_id)
);

-- Create inventory movements table
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'transfer', 'adjustment')),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  reference_document TEXT,
  batch_number TEXT,
  expiration_date DATE,
  supplier_id UUID REFERENCES public.inventory_suppliers(id),
  crane_id UUID REFERENCES public.cranes(id),
  operator_id UUID REFERENCES public.operators(id),
  maintenance_id UUID REFERENCES public.crane_maintenance(id),
  reason TEXT,
  observations TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  movement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create inventory alerts table
CREATE TABLE public.inventory_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  location_id UUID REFERENCES public.inventory_locations(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiration', 'excess_stock')),
  threshold_value INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create inventory consumptions table for crane-specific tracking
CREATE TABLE public.inventory_consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_id UUID NOT NULL REFERENCES public.inventory_movements(id),
  crane_id UUID NOT NULL REFERENCES public.cranes(id),
  operator_id UUID REFERENCES public.operators(id),
  maintenance_type TEXT CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency')),
  odometer_reading INTEGER,
  operation_hours INTEGER,
  work_order_number TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  approved_by UUID REFERENCES public.profiles(id),
  consumption_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS on all tables
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_consumptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Categories
CREATE POLICY "inventory_categories_select_policy" ON public.inventory_categories FOR SELECT USING (true);
CREATE POLICY "inventory_categories_modify_policy" ON public.inventory_categories FOR ALL USING (is_operator_user());

-- Suppliers
CREATE POLICY "inventory_suppliers_select_policy" ON public.inventory_suppliers FOR SELECT USING (true);
CREATE POLICY "inventory_suppliers_modify_policy" ON public.inventory_suppliers FOR ALL USING (is_operator_user());

-- Locations
CREATE POLICY "inventory_locations_select_policy" ON public.inventory_locations FOR SELECT USING (true);
CREATE POLICY "inventory_locations_modify_policy" ON public.inventory_locations FOR ALL USING (is_operator_user());

-- Items
CREATE POLICY "inventory_items_select_policy" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "inventory_items_modify_policy" ON public.inventory_items FOR ALL USING (is_operator_user());

-- Stock
CREATE POLICY "inventory_stock_select_policy" ON public.inventory_stock FOR SELECT USING (true);
CREATE POLICY "inventory_stock_modify_policy" ON public.inventory_stock FOR ALL USING (is_operator_user());

-- Movements
CREATE POLICY "inventory_movements_select_policy" ON public.inventory_movements FOR SELECT USING (true);
CREATE POLICY "inventory_movements_modify_policy" ON public.inventory_movements FOR ALL USING (is_operator_user());

-- Alerts
CREATE POLICY "inventory_alerts_select_policy" ON public.inventory_alerts FOR SELECT USING (true);
CREATE POLICY "inventory_alerts_modify_policy" ON public.inventory_alerts FOR ALL USING (is_operator_user());

-- Consumptions
CREATE POLICY "inventory_consumptions_select_policy" ON public.inventory_consumptions FOR SELECT USING (true);
CREATE POLICY "inventory_consumptions_modify_policy" ON public.inventory_consumptions FOR ALL USING (is_operator_user());

-- Create function to update stock quantities
CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update stock based on movement type
    IF NEW.movement_type = 'entry' THEN
      INSERT INTO public.inventory_stock (item_id, location_id, current_quantity)
      VALUES (NEW.item_id, NEW.location_id, NEW.quantity)
      ON CONFLICT (item_id, location_id)
      DO UPDATE SET 
        current_quantity = inventory_stock.current_quantity + NEW.quantity,
        last_movement_date = NEW.movement_date,
        updated_at = now();
    ELSIF NEW.movement_type = 'exit' THEN
      UPDATE public.inventory_stock 
      SET 
        current_quantity = current_quantity - NEW.quantity,
        last_movement_date = NEW.movement_date,
        updated_at = now()
      WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for stock updates
CREATE TRIGGER trigger_update_inventory_stock
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_stock();

-- Create function to check stock alerts
CREATE OR REPLACE FUNCTION public.check_inventory_alerts()
RETURNS TRIGGER AS $$
DECLARE
  item_record RECORD;
  alert_record RECORD;
BEGIN
  -- Get item details
  SELECT * INTO item_record FROM public.inventory_items WHERE id = NEW.item_id;
  
  -- Check low stock alerts
  IF NEW.current_quantity <= item_record.minimum_stock THEN
    INSERT INTO public.notification_logs (user_id, type, title, body, data)
    SELECT 
      p.id,
      'inventory_alert',
      'Stock Bajo: ' || item_record.name,
      'El producto ' || item_record.name || ' tiene stock bajo (' || NEW.current_quantity || ' unidades)',
      jsonb_build_object('item_id', NEW.item_id, 'location_id', NEW.location_id, 'quantity', NEW.current_quantity)
    FROM public.profiles p 
    WHERE p.role IN ('admin', 'operator');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for alerts
CREATE TRIGGER trigger_check_inventory_alerts
  AFTER UPDATE OF current_quantity ON public.inventory_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.check_inventory_alerts();

-- Create updated_at triggers
CREATE TRIGGER update_inventory_categories_updated_at
  BEFORE UPDATE ON public.inventory_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_suppliers_updated_at
  BEFORE UPDATE ON public.inventory_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_locations_updated_at
  BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_stock_updated_at
  BEFORE UPDATE ON public.inventory_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_alerts_updated_at
  BEFORE UPDATE ON public.inventory_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default data
INSERT INTO public.inventory_categories (name, description, code) VALUES
('Repuestos Motor', 'Piezas y componentes del motor', 'MOTOR'),
('Repuestos Hidráulico', 'Sistema hidráulico y componentes', 'HIDRA'),
('Neumáticos', 'Llantas y neumáticos', 'NEUM'),
('Lubricantes', 'Aceites y lubricantes', 'LUB'),
('Filtros', 'Filtros de aire, aceite y combustible', 'FILT'),
('Herramientas', 'Herramientas de trabajo', 'HERR'),
('Consumibles', 'Materiales de consumo general', 'CONS');

INSERT INTO public.inventory_locations (name, code, description) VALUES
('Bodega Principal', 'BP001', 'Bodega principal de repuestos'),
('Taller Mecánico', 'TM001', 'Stock del taller mecánico'),
('Oficina Central', 'OC001', 'Almacén de oficina central'),
('Bodega Neumáticos', 'BN001', 'Bodega especializada en neumáticos');