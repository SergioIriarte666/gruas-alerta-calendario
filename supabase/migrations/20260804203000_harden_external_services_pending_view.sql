BEGIN;

-- La vista fue creada por postgres y, sin esta opción, ejecuta la consulta con
-- los permisos de su propietario. Eso evita que se apliquen las políticas RLS
-- del usuario que consulta y activa el warning 0010 del Security Advisor.
-- ALTER VIEW conserva la consulta, el orden de columnas y sus dependencias.
ALTER VIEW public.external_services_pending
  SET (security_invoker = true);

-- Las vistas reciben los privilegios por defecto de las tablas del esquema.
-- Este helper forma parte del backoffice: no debe estar expuesto a anon.
REVOKE ALL ON public.external_services_pending FROM PUBLIC, anon;
GRANT SELECT ON public.external_services_pending TO authenticated, service_role;

COMMENT ON VIEW public.external_services_pending IS
  'Servicios externo_tercero pendientes de cierre. SECURITY INVOKER: respeta permisos y RLS del usuario que consulta.';

COMMIT;
