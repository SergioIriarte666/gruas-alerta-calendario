BEGIN;

-- Entidad dueña del gasto (según RUT receptor del documento) y quién financió la plata.
-- G5N financia hoy el 100% de los gastos de LowBoy; ambas columnas quedan separadas para
-- poder medir la deuda intercompañía incluso cuando LowBoy empiece a pagar solo.
ALTER TABLE public.costs
  ADD COLUMN IF NOT EXISTS entity text NOT NULL DEFAULT 'gruas_5_norte'
    CHECK (entity IN ('gruas_5_norte', 'lowboy')),
  ADD COLUMN IF NOT EXISTS paid_by text NOT NULL DEFAULT 'gruas_5_norte'
    CHECK (paid_by IN ('gruas_5_norte', 'lowboy')),
  ADD COLUMN IF NOT EXISTS dte_tipo integer,
  ADD COLUMN IF NOT EXISTS dte_folio bigint,
  ADD COLUMN IF NOT EXISTS dte_rut_emisor text;

-- Backfill determinístico: los 2 equipos LowBoy existentes en el maestro de grúas
-- (DSBZ-85, JD-6696). El tercer equipo (lowboy Fontaine, USA, sin patente chilena) no
-- tiene fila propia en cranes todavía: sus costos ya están parqueados bajo DSBZ-85
-- (ver costo "Cable Huinche LowBoy", nota "Asignar a Lowboy una vez contar con PPU"),
-- por lo que este filtro captura igualmente el 100% de los costos LowBoy existentes.
-- Bypass del trigger prevent_non_admin_updates_on_paid_costs: muchos de estos costos ya
-- están pagados y esta migración corre sin sesión de usuario admin autenticada. Es un
-- cambio de metadata (entity), no toca amount/payment_date.
SELECT set_config('app.sync_in_progress', 'true', true);

UPDATE public.costs SET entity = 'lowboy'
WHERE crane_id IN ('186d1c6b-d6f3-47be-b159-425b025cbe55', '9eac9487-c076-4c5a-ac16-6a5a94c1ae48');
-- paid_by queda en 'gruas_5_norte' por default: correcto, G5N financió todo hasta hoy.

SELECT set_config('app.sync_in_progress', 'false', true);

-- Abonos/devoluciones entre G5N y LowBoy (movimientos de la cuenta corriente intercompañía).
CREATE TABLE IF NOT EXISTS public.intercompany_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  direction text NOT NULL DEFAULT 'lowboy_to_g5n'
    CHECK (direction IN ('lowboy_to_g5n', 'g5n_to_lowboy')),
  description text NOT NULL,
  reference text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_costs_entity ON public.costs(entity);
CREATE INDEX IF NOT EXISTS idx_costs_entity_paidby ON public.costs(entity, paid_by);
CREATE INDEX IF NOT EXISTS idx_costs_dte
  ON public.costs(dte_tipo, dte_folio, dte_rut_emisor) WHERE dte_folio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intercompany_adjustments_date
  ON public.intercompany_adjustments(adjustment_date);

ALTER TABLE public.intercompany_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intercompany_adjustments_admin_full_access" ON "public"."intercompany_adjustments"
  TO "authenticated"
  USING ("public"."is_admin_user_safe"())
  WITH CHECK ("public"."is_admin_user_safe"());

CREATE POLICY "intercompany_adjustments_viewer_select" ON "public"."intercompany_adjustments"
  FOR SELECT TO "authenticated"
  USING (public.get_current_user_role_safe() = 'viewer'::public.app_role);

COMMENT ON COLUMN public.costs.entity IS
  'Entidad legal dueña del gasto según RUT receptor del documento (gruas_5_norte | lowboy). No inferir por crane_id en código nuevo.';
COMMENT ON COLUMN public.costs.paid_by IS
  'Entidad que financió el gasto (fuente de la plata). Hoy siempre gruas_5_norte hasta que LowBoy tenga independencia financiera.';
COMMENT ON TABLE public.intercompany_adjustments IS
  'Abonos y devoluciones entre Grúas 5 Norte y LowBoy Chile SpA para la cuenta corriente intercompañía.';

COMMIT;
