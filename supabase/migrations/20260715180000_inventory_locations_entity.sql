BEGIN;

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS entity text NOT NULL DEFAULT 'gruas_5_norte'
  CHECK (entity IN ('gruas_5_norte','lowboy'));

UPDATE public.inventory_locations
SET entity = 'lowboy'
WHERE id = '49ea7343-d6cf-4231-9579-d924406f7b6b'
  AND entity <> 'lowboy';

COMMIT;
