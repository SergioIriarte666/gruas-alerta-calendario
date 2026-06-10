BEGIN;

WITH invited_roles AS (
  SELECT
    p.id AS user_id,
    COALESCE(
      (
        SELECT ur.role::text
        FROM public.user_roles ur
        WHERE ur.user_id = p.id
        ORDER BY CASE ur.role
          WHEN 'admin' THEN 1
          WHEN 'operator' THEN 2
          WHEN 'client' THEN 3
          WHEN 'viewer' THEN 4
          ELSE 5
        END
        LIMIT 1
      ),
      p.role::text
    ) AS resolved_role
  FROM public.profiles p
  INNER JOIN public.user_invitations ui
    ON ui.user_id = p.id
)
UPDATE public.profiles p
SET
  status = 'approved',
  role = invited_roles.resolved_role::app_role,
  updated_at = now()
FROM invited_roles
WHERE p.id = invited_roles.user_id
  AND (
    p.status IS DISTINCT FROM 'approved'
    OR p.role IS DISTINCT FROM invited_roles.resolved_role::app_role
  );

COMMIT;
