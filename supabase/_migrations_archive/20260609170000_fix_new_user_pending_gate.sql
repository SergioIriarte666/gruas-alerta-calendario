BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
    RAISE NOTICE 'Profile with email % already exists', NEW.email;
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    'viewer',
    'pending'
  );

  RETURN NEW;
END;
$$;

COMMIT;
