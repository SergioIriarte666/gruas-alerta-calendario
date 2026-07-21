ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS interface_density text NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS text_scale integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reduce_motion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sidebar_collapsed boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_check,
  DROP CONSTRAINT IF EXISTS user_settings_interface_density_check,
  DROP CONSTRAINT IF EXISTS user_settings_text_scale_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_theme_check
    CHECK (theme IN ('light', 'dark', 'system')),
  ADD CONSTRAINT user_settings_interface_density_check
    CHECK (interface_density IN ('comfortable', 'compact')),
  ADD CONSTRAINT user_settings_text_scale_check
    CHECK (text_scale IN (100, 110, 120));
