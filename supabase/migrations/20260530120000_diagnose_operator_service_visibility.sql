-- ============================================================
-- Diagnostic helpers: operator ↔ service visibility
-- Safe (read-only functions). Run as admin in SQL Editor.
-- ============================================================

-- ============================================================
-- 1. check_operator_visibility(email)
--    Returns a JSON report showing exactly why an operator
--    can or cannot see their services.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_operator_visibility(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id     uuid;
  v_profile_role   text;
  v_has_op_role    boolean;
  v_operator_id    uuid;
  v_operator_name  text;
  v_services_direct  int;
  v_services_resource int;
  v_resource_types   text[];
  v_pending_direct   int;
  v_pending_resource int;
BEGIN
  -- 1. Profile lookup
  SELECT id, role INTO v_profile_id, v_profile_role
  FROM public.profiles
  WHERE email = p_email
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No profile found for email: ' || p_email
    );
  END IF;

  -- 2. user_roles check
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_profile_id AND role = 'operator'
  ) INTO v_has_op_role;

  -- 3. Operator record
  SELECT id, name INTO v_operator_id, v_operator_name
  FROM public.operators
  WHERE user_id = v_profile_id
  LIMIT 1;

  -- 4. Services via direct operator_id
  SELECT COUNT(*) INTO v_services_direct
  FROM public.services
  WHERE operator_id = v_operator_id;

  SELECT COUNT(*) INTO v_pending_direct
  FROM public.services
  WHERE operator_id = v_operator_id
    AND status = 'pending';

  -- 5. Services via service_resources
  SELECT COUNT(DISTINCT service_id) INTO v_services_resource
  FROM public.service_resources
  WHERE operator_id = v_operator_id;

  SELECT COUNT(DISTINCT sr.service_id) INTO v_pending_resource
  FROM public.service_resources sr
  JOIN public.services s ON s.id = sr.service_id
  WHERE sr.operator_id = v_operator_id
    AND s.status = 'pending';

  -- 6. Distinct resource_type values for this operator
  SELECT ARRAY_AGG(DISTINCT resource_type) INTO v_resource_types
  FROM public.service_resources
  WHERE operator_id = v_operator_id;

  RETURN jsonb_build_object(
    'email',              p_email,
    'profile_id',         v_profile_id,
    'profile_role',       v_profile_role,
    'has_operator_role_in_user_roles', v_has_op_role,
    'operator_id',        v_operator_id,
    'operator_name',      v_operator_name,
    'operator_user_id_set', (v_operator_id IS NOT NULL),
    'services_via_direct_operator_id', v_services_direct,
    'services_pending_via_direct',     v_pending_direct,
    'services_via_service_resources',  v_services_resource,
    'services_pending_via_resources',  v_pending_resource,
    'resource_types_found',            to_jsonb(v_resource_types),
    'diagnosis', CASE
      WHEN v_profile_id IS NULL THEN
        'FAIL: perfil no existe para este email'
      WHEN NOT v_has_op_role THEN
        'FAIL: user_roles no tiene role=''operator'' para este usuario. Agregar fila en user_roles.'
      WHEN v_operator_id IS NULL THEN
        'FAIL: no hay fila en operators con user_id = profile_id. Ejecutar UPDATE operators SET user_id = ... '
      WHEN v_services_direct = 0 AND v_services_resource = 0 THEN
        'INFO: operador configurado correctamente pero no tiene servicios asignados aún'
      WHEN v_pending_direct = 0 AND v_pending_resource = 0 THEN
        'INFO: tiene servicios pero ninguno en estado ''pending'' (tab Asignados). Revisar otros tabs.'
      ELSE
        'OK: configuración correcta — ' ||
        v_services_direct || ' servicios vía operator_id, ' ||
        v_services_resource || ' vía service_resources'
    END
  );
END;
$$;

COMMENT ON FUNCTION public.check_operator_visibility(text) IS
  'Diagnóstico de visibilidad de servicios para un operador dado su email. Ejecutar como admin.';

-- ============================================================
-- 2. list_operators_config()
--    Overview of all operators: user_id linked, role set, service counts.
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_operators_config()
RETURNS TABLE (
  operator_id   uuid,
  operator_name text,
  email         text,
  user_id_set   boolean,
  has_op_role   boolean,
  services_direct  bigint,
  services_resource bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id                                        AS operator_id,
    o.name                                      AS operator_name,
    p.email                                     AS email,
    (o.user_id IS NOT NULL)                     AS user_id_set,
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = o.user_id AND ur.role = 'operator'
    )                                           AS has_op_role,
    (SELECT COUNT(*) FROM public.services s WHERE s.operator_id = o.id)   AS services_direct,
    (SELECT COUNT(DISTINCT sr.service_id) FROM public.service_resources sr
     WHERE sr.operator_id = o.id)              AS services_resource
  FROM public.operators o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.is_active = true
  ORDER BY o.name;
$$;

COMMENT ON FUNCTION public.list_operators_config() IS
  'Resumen de todos los operadores activos: si tienen user_id, rol y cantidad de servicios. Ejecutar como admin.';
