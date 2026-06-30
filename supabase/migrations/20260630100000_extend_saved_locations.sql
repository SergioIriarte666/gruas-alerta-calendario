BEGIN;

ALTER TABLE public.saved_locations
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.saved_locations
  ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.saved_locations
SET aliases = COALESCE(aliases, '{}'::text[])
WHERE aliases IS NULL;

CREATE INDEX IF NOT EXISTS idx_saved_locations_name_lower
  ON public.saved_locations (lower(name));

CREATE INDEX IF NOT EXISTS idx_saved_locations_aliases
  ON public.saved_locations USING gin (aliases);

CREATE OR REPLACE FUNCTION public.touch_saved_locations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saved_locations_updated_at ON public.saved_locations;
CREATE TRIGGER trg_saved_locations_updated_at
  BEFORE UPDATE ON public.saved_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_saved_locations_updated_at();

COMMIT;
