-- Update function to delete user and profile correctly
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can delete users
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can delete users';
  END IF;

  -- First delete the profile (this will also delete related data via cascade)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Then delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;