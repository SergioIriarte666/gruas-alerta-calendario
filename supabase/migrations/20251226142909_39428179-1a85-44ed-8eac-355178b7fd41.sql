-- ===========================================
-- SISTEMA DE NOTIFICACIONES ROBUSTO
-- ===========================================

-- 1. Crear tabla principal de notificaciones persistentes
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contenido
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, error, success
  category TEXT NOT NULL DEFAULT 'system', -- services, invoices, documents, closures, system
  
  -- Prioridad (1=crítico, 2=urgente, 3=importante, 4=normal, 5=bajo)
  priority INTEGER NOT NULL DEFAULT 4 CHECK (priority >= 1 AND priority <= 5),
  
  -- Agrupación
  group_key TEXT, -- Para agrupar notificaciones similares
  group_count INTEGER DEFAULT 1,
  
  -- Navegación
  action_type TEXT, -- navigate, filter, highlight
  action_url TEXT,
  action_data JSONB,
  entity_type TEXT, -- service, invoice, crane, operator, closure
  entity_id UUID,
  
  -- Estados
  read_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_group_key ON public.notifications(group_key) WHERE group_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_notifications_updated_at();

-- 4. RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propias notificaciones
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Los usuarios pueden marcar como leídas/archivar sus propias notificaciones
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Solo el sistema puede insertar notificaciones (via service role o triggers)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Los usuarios pueden eliminar sus propias notificaciones
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- 5. Habilitar realtime para notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 6. Función para crear notificación
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_category TEXT DEFAULT 'system',
  p_priority INTEGER DEFAULT 4,
  p_action_url TEXT DEFAULT NULL,
  p_action_data JSONB DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_group_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, title, message, type, category, priority,
    action_url, action_data, entity_type, entity_id, group_key
  ) VALUES (
    p_user_id, p_title, p_message, p_type, p_category, p_priority,
    p_action_url, p_action_data, p_entity_type, p_entity_id, p_group_key
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Función para marcar como leída
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id AND user_id = auth.uid() AND read_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Función para marcar todas como leídas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Función para obtener resumen de notificaciones
CREATE OR REPLACE FUNCTION public.get_notification_summary()
RETURNS TABLE (
  total_count BIGINT,
  unread_count BIGINT,
  critical_count BIGINT,
  categories JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE read_at IS NULL)::BIGINT as unread_count,
    COUNT(*) FILTER (WHERE priority <= 2 AND read_at IS NULL)::BIGINT as critical_count,
    jsonb_object_agg(
      COALESCE(category, 'system'),
      category_count
    ) as categories
  FROM public.notifications n
  LEFT JOIN (
    SELECT category as cat, COUNT(*) as category_count
    FROM public.notifications
    WHERE user_id = auth.uid() AND read_at IS NULL
    GROUP BY category
  ) c ON n.category = c.cat
  WHERE n.user_id = auth.uid()
    AND n.dismissed_at IS NULL
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND (n.snoozed_until IS NULL OR n.snoozed_until <= now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;