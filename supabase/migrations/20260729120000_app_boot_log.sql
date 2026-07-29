-- Autopsia de arranques de la app operador.
--
-- El 28/07 la transmisión murió a las 15:26 y no revivió. Con los datos que
-- había no se puede distinguir entre las tres causas posibles —el sistema mató
-- el proceso, murió el watcher de ubicación, o murió la subida— porque ninguna
-- deja rastro. Cuando vuelva a pasar, este registro tiene que poder responder:
-- ¿la app arrancó de nuevo, cuándo, y traía un error del arranque anterior?
--
-- Una fila por arranque. Barato: son unos pocos arranques por operador y día.
--
-- `last_error` viaja EN EL ARRANQUE SIGUIENTE: un error fatal en el teléfono no
-- alcanza a subir nada —muchas veces el error ES que no hay red—, así que se
-- guarda en almacenamiento nativo y se sube cuando la app vuelve a abrir.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_boot_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  booted_at timestamptz NOT NULL DEFAULT now(),
  -- 'cold_start' | 'background' | 'url_open'. Texto libre a propósito: la lista
  -- de motivos va a crecer y un CHECK obligaría a migrar la base para poder
  -- registrar un dato de diagnóstico.
  launch_reason text NOT NULL DEFAULT 'cold_start',
  app_version text,
  platform text,
  /** Error fatal del arranque ANTERIOR, recuperado del almacenamiento nativo. */
  last_error text,
  /** Puntos que quedaron sin subir del arranque anterior: separa "murió la
      captura" (cola vacía) de "murió la subida" (cola llena). */
  pending_points integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_boot_log_operator_booted_at
  ON public.app_boot_log (operator_id, booted_at DESC);

-- Los arranques con error son la aguja del pajar: índice parcial para poder
-- pedirlos sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS idx_app_boot_log_with_error
  ON public.app_boot_log (booted_at DESC)
  WHERE last_error IS NOT NULL;

ALTER TABLE public.app_boot_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.app_boot_log TO authenticated;
GRANT ALL ON public.app_boot_log TO service_role;

-- El operador escribe SU propio arranque y nada más. Sin UPDATE ni DELETE para
-- nadie salvo el servicio: una autopsia editable no es una autopsia.
DROP POLICY IF EXISTS "Operators log their own boots" ON public.app_boot_log;
CREATE POLICY "Operators log their own boots"
  ON public.app_boot_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins read boot log" ON public.app_boot_log;
CREATE POLICY "Admins read boot log"
  ON public.app_boot_log
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

COMMENT ON TABLE public.app_boot_log IS
  'Un registro por arranque de la app operador. Sirve para reconstruir episodios de transmisión caída: si la app se relanzó, cuándo, con qué versión, y con qué error del arranque anterior.';

COMMIT;
