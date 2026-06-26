BEGIN;

CREATE TABLE IF NOT EXISTS public.user_dismissed_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_key text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notice_key)
);

COMMENT ON TABLE public.user_dismissed_notices IS
  'Banners/notices informativos que el usuario ha descartado. Una fila por (user_id, notice_key). El campo version permite forzar reaparición cuando cambia el contenido.';

CREATE INDEX IF NOT EXISTS idx_user_dismissed_notices_user
  ON public.user_dismissed_notices (user_id);

ALTER TABLE public.user_dismissed_notices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dismissed_notices'
      AND policyname = 'users_select_own_dismissed_notices'
  ) THEN
    CREATE POLICY "users_select_own_dismissed_notices"
      ON public.user_dismissed_notices
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dismissed_notices'
      AND policyname = 'users_insert_own_dismissed_notices'
  ) THEN
    CREATE POLICY "users_insert_own_dismissed_notices"
      ON public.user_dismissed_notices
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dismissed_notices'
      AND policyname = 'users_update_own_dismissed_notices'
  ) THEN
    CREATE POLICY "users_update_own_dismissed_notices"
      ON public.user_dismissed_notices
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_dismissed_notices'
      AND policyname = 'users_delete_own_dismissed_notices'
  ) THEN
    CREATE POLICY "users_delete_own_dismissed_notices"
      ON public.user_dismissed_notices
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

COMMIT;
