-- Agregar campos de contexto de solicitud al portal cliente
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent'));
