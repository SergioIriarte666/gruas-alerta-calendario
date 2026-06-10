-- ============================================================
-- FRONTEND ERROR LOGS
-- Tabla para persistir errores críticos de UI capturados
-- por el ErrorBoundary del frontend.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.frontend_error_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  component_name text NOT NULL,
  error_message text NOT NULL,
  error_stack   text,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent    text,
  url           text
);

COMMENT ON TABLE  public.frontend_error_logs IS 'Errores de UI reportados desde el frontend (ErrorBoundary)';
COMMENT ON COLUMN public.frontend_error_logs.component_name IS 'Nombre del componente React donde ocurrió el error';
COMMENT ON COLUMN public.frontend_error_logs.error_stack   IS 'Stack trace del error (puede ser nulo)';
COMMENT ON COLUMN public.frontend_error_logs.user_agent    IS 'navigator.userAgent del navegador';

ALTER TABLE public.frontend_error_logs ENABLE ROW LEVEL SECURITY;

-- Política: permitir INSERT a usuarios autenticados
CREATE POLICY "allow_insert_authenticated" ON public.frontend_error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: permitir INSERT a usuarios anónimos (errores deben poder registrarse siempre)
CREATE POLICY "allow_insert_anon" ON public.frontend_error_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Solo administradores pueden leer los logs
CREATE POLICY "allow_select_admin" ON public.frontend_error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
