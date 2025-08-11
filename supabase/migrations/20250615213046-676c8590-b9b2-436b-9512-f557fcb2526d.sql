
-- Manually create a profile for the existing user to fix the login loop.
-- This user was likely created before the automatic profile creation trigger was in place.
-- We are assigning the 'admin' role to ensure full access for development.
INSERT INTO public.profiles (id, email, full_name, role)
VALUES ('c6342c12-a2b4-420a-a2c0-439d1188887b', 'siriartev@gmail.com', 'siriartev@gmail.com', 'admin')
ON CONFLICT (id) DO NOTHING;
