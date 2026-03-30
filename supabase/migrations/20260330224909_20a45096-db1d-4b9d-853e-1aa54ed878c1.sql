
-- Fix: Replace overly permissive notifications INSERT policy
-- The current policy has (auth.uid() = user_id) OR (auth.uid() IS NOT NULL) which allows any authenticated user to insert for any user_id

DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
