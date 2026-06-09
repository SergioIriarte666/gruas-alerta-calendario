BEGIN;

CREATE TYPE crane_status AS ENUM (
  'active',
  'inactive',
  'sold',
  'written_off'
);

ALTER TABLE public.cranes
  ADD COLUMN IF NOT EXISTS status crane_status NOT NULL DEFAULT 'active';

UPDATE public.cranes
  SET status = CASE
    WHEN is_active = true  THEN 'active'::crane_status
    WHEN is_active = false THEN 'inactive'::crane_status
  END;

CREATE INDEX IF NOT EXISTS idx_cranes_status ON public.cranes(status);

COMMIT;
