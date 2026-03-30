-- Fix: Remove overly broad storage INSERT policy that bypasses bucket-specific restrictions
DROP POLICY IF EXISTS "authenticated_users_storage_insert" ON storage.objects;