
-- Crear tabla para suscripciones push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Crear tabla para logs de notificaciones
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('push', 'email', 'in_app')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions" 
  ON public.push_subscriptions 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Políticas para notification_logs
CREATE POLICY "Users can view their own notification logs" 
  ON public.notification_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification logs" 
  ON public.notification_logs 
  FOR INSERT 
  WITH CHECK (true);

-- Triggers para updated_at
CREATE OR REPLACE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);
