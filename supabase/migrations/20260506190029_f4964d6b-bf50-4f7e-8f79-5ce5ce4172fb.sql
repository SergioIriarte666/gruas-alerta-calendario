
-- 1) Lock down Realtime: require admin or operator role to subscribe to any channel
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Restrict realtime to staff" ON realtime.messages;

CREATE POLICY "Restrict realtime to staff"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'operator'::app_role)
);

-- 2) Remove the weak INSERT policy on quick-entry-photos that bypasses folder ownership
DROP POLICY IF EXISTS "Authenticated users can upload quick entry photos" ON storage.objects;
