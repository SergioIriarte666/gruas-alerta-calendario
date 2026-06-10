CREATE TABLE IF NOT EXISTS public.password_reset_rate_limits (
  email_hash text NOT NULL,
  ip_hash text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_attempt_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (email_hash, ip_hash)
);

ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_password_reset_rate_limits_blocked_until
  ON public.password_reset_rate_limits (blocked_until);

CREATE INDEX IF NOT EXISTS idx_password_reset_rate_limits_last_attempt_at
  ON public.password_reset_rate_limits (last_attempt_at DESC);
