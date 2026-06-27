# Hardening de seguridad Supabase

## Objetivo

Dejar el proyecto alineado con los warnings relevantes del linter de Supabase sin romper los flujos activos del sistema, en especial la app de operador y los módulos administrativos ya en uso.

## Qué corrige la migración

La migración [20260627170000_harden_supabase_security_warnings.sql](../../supabase/migrations/20260627170000_harden_supabase_security_warnings.sql):

- fija `search_path` en las funciones reportadas como mutables;
- mueve `pg_trgm` y `unaccent` al esquema `extensions`;
- revoca ejecución pública y anónima sobre funciones `SECURITY DEFINER`;
- conserva acceso `authenticated` solo en las RPCs usadas por la aplicación y helpers necesarios para RLS;
- cierra el insert directo a `frontend_error_logs`, dejando ese ingreso solo por la Edge Function `log-frontend-error`;
- elimina el listado público de objetos en `avatars` y `company-assets`;
- deshabilita `anonymous_signups_enabled` en `auth.config` cuando la columna existe en el proyecto.

## Qué validar después de aplicar

- volver a correr el linter de Supabase;
- probar login, backoffice, portal cliente y portal operador;
- confirmar carga de avatar/logo y visualización por URL pública;
- confirmar que los errores frontend siguen registrándose vía Edge Function;
- revisar que las RPCs administrativas críticas sigan respondiendo.

## Resultado esperado en el linter

- deberían desaparecer los warnings de `function_search_path_mutable`;
- deberían desaparecer los warnings de `extension_in_public`;
- deberían desaparecer los warnings de `public_bucket_allows_listing`;
- deberían desaparecer los warnings de `rls_policy_always_true` sobre `frontend_error_logs`;
- debería desaparecer `auth_allow_anonymous_sign_ins` si el proyecto expone la columna `auth.config.anonymous_signups_enabled`;
- si siguen existiendo warnings de `authenticated_security_definer_function_executable`, corresponderán a RPCs activas que hoy la app necesita para operar y su eliminación total requiere una segunda fase de rediseño.

## Ajuste manual pendiente

Si el linter sigue mostrando `auth_leaked_password_protection`, ese punto se corrige desde el panel de Supabase Auth y no desde este repositorio:

- Auth
- Security
- habilitar protección contra contraseñas filtradas
