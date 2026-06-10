
-- Eliminar políticas existentes en system_settings si las hay
DROP POLICY IF EXISTS "system_settings_select_all" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_all_admin" ON public.system_settings;

-- Crear políticas RLS optimizadas para system_settings
-- Permitir a todos los usuarios autenticados leer la configuración del sistema
CREATE POLICY "system_settings_select_authenticated" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

-- Permitir solo a administradores crear configuración inicial del sistema
CREATE POLICY "system_settings_insert_admin" ON public.system_settings
  FOR INSERT WITH CHECK (public.is_admin_user());

-- Permitir solo a administradores actualizar la configuración del sistema
CREATE POLICY "system_settings_update_admin" ON public.system_settings
  FOR UPDATE USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Permitir solo a administradores eliminar configuración del sistema
CREATE POLICY "system_settings_delete_admin" ON public.system_settings
  FOR DELETE USING (public.is_admin_user());

-- Asegurar que RLS esté habilitado en la tabla
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
