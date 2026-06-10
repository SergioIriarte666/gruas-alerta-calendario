-- Fix 1: Remove anon read access from sensitive storage buckets
-- Authenticated-only read policies already exist, so these are redundant and dangerous

DROP POLICY IF EXISTS "Public read access for crane documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view quick entry photos" ON storage.objects;