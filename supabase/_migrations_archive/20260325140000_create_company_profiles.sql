CREATE TABLE IF NOT EXISTS public.company_profiles (
  rut TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company profiles" ON public.company_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage company profiles" ON public.company_profiles
  FOR ALL USING (public.get_user_role() = 'admin');

DROP TRIGGER IF EXISTS update_company_profiles_updated_at ON public.company_profiles;
CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
