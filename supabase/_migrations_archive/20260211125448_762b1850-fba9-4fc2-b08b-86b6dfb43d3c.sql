-- Fix 1: service_change_history - restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can view change history" ON public.service_change_history;
CREATE POLICY "Authenticated users can view change history"
  ON public.service_change_history
  FOR SELECT
  USING (is_authenticated_user_safe());

-- Fix 2: income_categories - restrict public SELECT to authenticated users
DROP POLICY IF EXISTS "income_categories_select_all" ON public.income_categories;
CREATE POLICY "income_categories_select_authenticated"
  ON public.income_categories
  FOR SELECT
  USING (is_authenticated_user_safe());

-- Similarly for income_subcategories which has the same pattern
DROP POLICY IF EXISTS "income_subcategories_select_all" ON public.income_subcategories;
CREATE POLICY "income_subcategories_select_authenticated"
  ON public.income_subcategories
  FOR SELECT
  USING (is_authenticated_user_safe());

-- Fix 3: Make storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('crane-documents', 'quick-entry-photos');

-- Ensure proper RLS policies exist for these buckets (for authenticated users)
-- Drop any existing overly permissive policies first
DROP POLICY IF EXISTS "authenticated_read_crane_docs" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_write_crane_docs" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_quick_entry" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_write_quick_entry" ON storage.objects;

-- Create authenticated-only read policies
CREATE POLICY "authenticated_read_crane_docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'crane-documents');

CREATE POLICY "authenticated_write_crane_docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'crane-documents');

CREATE POLICY "authenticated_update_crane_docs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'crane-documents');

CREATE POLICY "authenticated_read_quick_entry"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'quick-entry-photos');

CREATE POLICY "authenticated_write_quick_entry"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quick-entry-photos');

CREATE POLICY "authenticated_update_quick_entry"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'quick-entry-photos');