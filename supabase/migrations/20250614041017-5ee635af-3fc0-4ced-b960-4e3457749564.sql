
-- Crear tabla para eventos del calendario
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('service', 'maintenance', 'meeting', 'deadline', 'other')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  crane_id UUID REFERENCES public.cranes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Habilitar RLS en la tabla calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para calendar_events
CREATE POLICY "Users can view all calendar_events" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Users can insert calendar_events" ON public.calendar_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update calendar_events" ON public.calendar_events FOR UPDATE USING (true);
CREATE POLICY "Users can delete calendar_events" ON public.calendar_events FOR DELETE USING (true);

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_calendar_events_date ON public.calendar_events(date);
CREATE INDEX idx_calendar_events_type ON public.calendar_events(type);
CREATE INDEX idx_calendar_events_service_id ON public.calendar_events(service_id);
