
-- This trigger ensures that a new profile is automatically created in the public.profiles table
-- whenever a new user signs up and is added to the auth.users table.
-- This prevents authentication loops where a user exists in auth but has no profile data.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
