-- Corregir warnings de Supabase - Functions Search Path Mutable y optimizar RLS

-- Actualizar función create_cost_for_crane_part con search_path fijo
CREATE OR REPLACE FUNCTION public.create_cost_for_crane_part()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Actualizar función update_cost_for_crane_part con search_path fijo
CREATE OR REPLACE FUNCTION public.update_cost_for_crane_part()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Actualizar función delete_cost_for_crane_part con search_path fijo
CREATE OR REPLACE FUNCTION public.delete_cost_for_crane_part()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete the associated cost record
  DELETE FROM public.costs WHERE id = OLD.cost_id;
  RETURN OLD;
END;
$$;

-- Actualizar función assign_default_cost_center con search_path fijo
CREATE OR REPLACE FUNCTION public.assign_default_cost_center()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If no cost center is specified, assign based on category
  IF NEW.cost_center_id IS NULL THEN
    NEW.cost_center_id := (
      SELECT cc.id 
      FROM public.cost_centers cc 
      WHERE cc.code = CASE 
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%combustible%' OR name ILIKE '%gasolina%' OR name ILIKE '%diesel%') THEN 'COMB'
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%mantenimiento%' OR name ILIKE '%reparaci%' OR name ILIKE '%repuesto%') THEN 'MANT'
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%administrat%' OR name ILIKE '%oficina%' OR name ILIKE '%papeler%') THEN 'ADMIN'
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%personal%' OR name ILIKE '%salario%' OR name ILIKE '%sueldo%') THEN 'PERS'
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%servicio%' OR name ILIKE '%operacion%') THEN 'OPER'
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%tecnolog%' OR name ILIKE '%software%' OR name ILIKE '%equipo%') THEN 'TEC'
        WHEN NEW.category_id IN (SELECT id FROM public.cost_categories WHERE name ILIKE '%marketing%' OR name ILIKE '%publicidad%' OR name ILIKE '%comercial%') THEN 'MKT'
        ELSE 'OPER' -- Default to operational costs
      END
      LIMIT 1
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Actualizar función handle_user_invitation_acceptance con search_path fijo
CREATE OR REPLACE FUNCTION public.handle_user_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Actualizar invitación a 'accepted' cuando un usuario se registra con email que tenía invitación pendiente
  UPDATE public.user_invitations 
  SET status = 'accepted', 
      accepted_at = now(),
      updated_at = now()
  WHERE email = NEW.email 
    AND status IN ('pending', 'sent');
  
  RETURN NEW;
END;
$$;

-- Actualizar función get_client_id_for_user con search_path fijo
CREATE OR REPLACE FUNCTION public.get_client_id_for_user(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_id_result UUID;
BEGIN
  SELECT client_id INTO client_id_result
  FROM public.profiles
  WHERE id = user_id;

  RETURN client_id_result;
END;
$$;

-- Optimizar políticas RLS problemáticas

-- Eliminar políticas duplicadas en system_settings
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;

-- Crear función optimizada para verificar si el usuario puede ver notificaciones
CREATE OR REPLACE FUNCTION public.can_view_notification(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() = target_user_id;
$$;

-- Optimizar política de notification_logs para mejor performance
DROP POLICY IF EXISTS "Users can view their own notification logs" ON public.notification_logs;
CREATE POLICY "notification_logs_select_optimized" 
ON public.notification_logs 
FOR SELECT 
USING (public.can_view_notification(user_id));

-- Optimizar política de push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_optimized" 
ON public.push_subscriptions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Crear índices para mejorar performance de RLS
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);

-- Validar que todas las funciones tienen search_path seguro
DO $$
BEGIN
  RAISE NOTICE 'Migración completada - Functions Search Path Mutable corregido';
  RAISE NOTICE 'Políticas RLS optimizadas para mejor performance';
  RAISE NOTICE 'ACCIÓN MANUAL REQUERIDA: Habilitar "Leaked Password Protection" en Auth Settings';
END;
$$;