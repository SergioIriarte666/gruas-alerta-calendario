-- El outbox de notificaciones pasa a aceptar checklists de seguridad.
--
-- BLOQUEADOR que resuelve esta migración: `notification_outbox.service_id` era NOT
-- NULL, y un checklist NO tiene servicio — su independencia del flujo de servicio
-- es la decisión de diseño del módulo, no un descuido. Sin aflojar ese NOT NULL no
-- hay forma de encolar el envío.
--
-- Aflojarlo sin más abriría la puerta a filas huérfanas de cualquier kind, así que
-- el NOT NULL se reemplaza por un CHECK que dice exactamente quién puede venir sin
-- servicio: solo 'checklist_email', y a cambio le exige checklist_id.

BEGIN;

-- ── a) Referencia al checklist ──────────────────────────────────────────────
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS checklist_id uuid
    REFERENCES public.checklists(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.notification_outbox.checklist_id IS
  'Checklist de seguridad a despachar. Obligatorio para kind = checklist_email y '
  'NULL para el resto. Ver notification_outbox_reference_check.';

-- ── b) El servicio deja de ser obligatorio ──────────────────────────────────
ALTER TABLE public.notification_outbox
  ALTER COLUMN service_id DROP NOT NULL;

-- ── d) CHECK de kind: se REEMPLAZA, nunca se altera ─────────────────────────
-- DROP + ADD con la lista completa escrita a mano. Un ALTER que perdiera uno de
-- los 6 valores originales rompería tracking e inspección en producción, y el
-- fallo aparecería recién al encolar la siguiente notificación.
ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;

ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_kind_check CHECK (
    kind = ANY (ARRAY[
      'tracking_link'::text,
      'inspection_whatsapp'::text,
      'inspection_email'::text,
      'delivery_whatsapp'::text,
      'delivery_email'::text,
      'operator_tracking_silence'::text,
      'checklist_email'::text
    ])
  );

-- ── c) Guard de coherencia referencial ──────────────────────────────────────
-- Lo que el NOT NULL garantizaba para todos, ahora lo garantiza esto para cada
-- kind: checklist_email trae checklist y NO trae servicio; el resto trae servicio.
ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_reference_check;

ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_reference_check CHECK (
    (kind = 'checklist_email' AND checklist_id IS NOT NULL AND service_id IS NULL)
    OR (kind <> 'checklist_email' AND service_id IS NOT NULL)
  );

-- ── e) Índice para el reenvío idempotente ───────────────────────────────────
-- La UI pregunta "¿ya hay una fila pending o processing para este checklist?"
-- antes de volver a encolar; este índice es el que hace barata esa consulta.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_checklist
  ON public.notification_outbox (checklist_id)
  WHERE checklist_id IS NOT NULL;

-- NOTA: `claim_notification_outbox` NO se toca. Se leyó su cuerpo antes de migrar
-- (SELECT prosrc FROM pg_proc WHERE proname='claim_notification_outbox') y filtra
-- solo por status='pending' AND attempts < 5, sin mencionar service_id, así que
-- las filas sin servicio las reclama igual. Como devuelve SETOF
-- notification_outbox, la columna nueva viaja sola: su firma no cambia.

-- El CHECK de status tampoco se toca.

COMMIT;
