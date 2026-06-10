-- Fix search_path security warnings in public functions
-- Replace functions with explicit schema qualifications

-- Fix validate_email function
CREATE OR REPLACE FUNCTION public.validate_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix check_inventory_alerts function
CREATE OR REPLACE FUNCTION public.check_inventory_alerts()
RETURNS void AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN 
    SELECT id, name, current_stock, min_stock_alert 
    FROM public.inventory 
    WHERE current_stock <= min_stock_alert AND min_stock_alert > 0
  LOOP
    INSERT INTO public.notifications (title, message, type, user_id, created_at)
    SELECT 
      'Stock Bajo: ' || item.name,
      'El item ' || item.name || ' tiene stock bajo. Stock actual: ' || item.current_stock || ', Mínimo: ' || item.min_stock_alert,
      'warning',
      p.id,
      now()
    FROM public.profiles p 
    WHERE p.role IN ('admin', 'manager');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix update_inventory_stock function
CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS trigger AS $$
DECLARE
  inventory_item_id uuid;
BEGIN
  SELECT inventory_id INTO inventory_item_id
  FROM public.crane_parts
  WHERE id = NEW.id;
  
  IF inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory
    SET current_stock = current_stock - NEW.quantity
    WHERE id = inventory_item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix sync_parts_purchase_to_inventory function
CREATE OR REPLACE FUNCTION public.sync_parts_purchase_to_inventory()
RETURNS trigger AS $$
DECLARE
  existing_item_id uuid;
BEGIN
  SELECT id INTO existing_item_id
  FROM public.inventory
  WHERE LOWER(name) = LOWER(NEW.part_name)
  LIMIT 1;
  
  IF existing_item_id IS NOT NULL THEN
    UPDATE public.inventory
    SET 
      current_stock = current_stock + NEW.quantity,
      unit_cost = NEW.unit_value,
      updated_at = now()
    WHERE id = existing_item_id;
    
    NEW.inventory_id = existing_item_id;
  ELSE
    INSERT INTO public.inventory (
      name,
      description,
      current_stock,
      unit_cost,
      category,
      location,
      created_at,
      updated_at
    ) VALUES (
      NEW.part_name,
      'Auto-creado desde compra de pieza',
      NEW.quantity,
      NEW.unit_value,
      'Repuestos',
      'Almacén Principal',
      now(),
      now()
    ) RETURNING id INTO existing_item_id;
    
    NEW.inventory_id = existing_item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix assign_default_cost_center function
CREATE OR REPLACE FUNCTION public.assign_default_cost_center()
RETURNS trigger AS $$
DECLARE
  default_center_id uuid;
BEGIN
  IF NEW.cost_center_id IS NULL THEN
    SELECT id INTO default_center_id
    FROM public.cost_centers
    WHERE name = 'General'
    LIMIT 1;
    
    IF default_center_id IS NULL THEN
      INSERT INTO public.cost_centers (name, description)
      VALUES ('General', 'Centro de costo por defecto')
      RETURNING id INTO default_center_id;
    END IF;
    
    NEW.cost_center_id = default_center_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix update_crane_expiry_on_document_upload function
CREATE OR REPLACE FUNCTION public.update_crane_expiry_on_document_upload()
RETURNS trigger AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    UPDATE public.cranes
    SET 
      document_expiry = NEW.expiry_date,
      updated_at = now()
    WHERE id = NEW.crane_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';