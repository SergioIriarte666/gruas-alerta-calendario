-- Create function to delete user with admin privileges
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

  -- Delete from auth.users (cascade will handle profiles and related data)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;