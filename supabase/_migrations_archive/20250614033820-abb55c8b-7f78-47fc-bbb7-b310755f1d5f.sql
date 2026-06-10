
-- Fix security warnings by setting immutable search_path for functions

-- Update get_user_role function with fixed search_path
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- Update handle_new_user function with fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update update_updated_at_column function with fixed search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
