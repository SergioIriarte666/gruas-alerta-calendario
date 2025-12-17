-- Tabla para almacenar permisos de módulos por usuario
CREATE TABLE public.user_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, module_key)
);

-- Habilitar RLS
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Política: admins pueden gestionar todos los permisos
CREATE POLICY "Admins can manage all permissions"
ON public.user_module_permissions
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Política: usuarios pueden ver sus propios permisos
CREATE POLICY "Users can view own permissions"
ON public.user_module_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_user_module_permissions_updated_at
BEFORE UPDATE ON public.user_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();