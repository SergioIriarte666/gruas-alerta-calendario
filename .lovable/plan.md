
Problema (lo que está pasando)
- En tu captura se ve “¡Inicio de sesión exitoso!”, pero te quedas en /auth y no redirige al portal operador.
- Los logs confirman la causa exacta:
  - Auth OK (SIGNED_IN)
  - UserContext intenta cargar perfil por id = authUser.id → no existe (PGRST116 “0 rows”)
  - UserContext intenta crear perfil con ese id + mismo email → falla por UNIQUE (23505 “profiles_email_unique”)
- Esto ocurre porque hoy el flujo de “crear usuario (admin)” pre-crea un registro en profiles con un UUID “pre-registrado” (no es el mismo UUID que crea Supabase Auth cuando el usuario se registra). Luego, al registrarse con el mismo email, el trigger evita crear un segundo perfil por email (para no duplicar), quedando el auth user sin perfil y el sistema no puede decidir el rol ni redirigir.

Objetivo
1) Desbloquear inmediatamente el usuario operador que estás probando (para que entre a /operator).
2) Arreglar el flujo de invitación/creación para que cualquier nuevo operador pueda registrarse y entrar sin quedar “pegado” en /auth.

1) Desbloqueo inmediato (para que puedas probar hoy)
A. Arreglo puntual en BD (Test) para el usuario que quedó “pegado”
- Haremos que exista un profile cuyo id sea el auth.uid() real del usuario que inicia sesión, y relinkear el operador a ese id.
- Como hoy ya existe un profile con ese email (pre-registrado), para respetar el UNIQUE(email) se renombra el email del profile viejo a “legacy” y se crea el profile correcto con el email real.
- Nota: esto se hace en TEST para probar. Si el problema existe también en LIVE, te dejo el mismo SQL para correr en LIVE antes de publicar cambios (si corresponde).

SQL propuesto (ejemplo basado en tu caso actual):
- auth user id (del log): bb6d8e6e-d13f-464b-9fe2-951f6464f7ea
- profile pre-registrado id (actual): dc74a82e-19ef-414a-a662-1b1b5990affe
- email: pagos@gruas5norte.cl

```sql
begin;

-- 1) Renombrar email del perfil pre-registrado para liberar el UNIQUE(email)
update public.profiles
set email = email || '__legacy__' || substring(id::text, 1, 8),
    updated_at = now()
where id = 'dc74a82e-19ef-414a-a662-1b1b5990affe';

-- 2) Crear el perfil “real” con el mismo id del usuario Auth
insert into public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
values (
  'bb6d8e6e-d13f-464b-9fe2-951f6464f7ea',
  'pagos@gruas5norte.cl',
  'pagos@gruas5norte.cl',
  'operator',
  true,
  now(),
  now()
);

-- 3) Relink del operador (y lo que corresponda) al nuevo profile id
update public.operators
set user_id = 'bb6d8e6e-d13f-464b-9fe2-951f6464f7ea'
where user_id = 'dc74a82e-19ef-414a-a662-1b1b5990affe';

update public.user_invitations
set user_id = 'bb6d8e6e-d13f-464b-9fe2-951f6464f7ea'
where user_id = 'dc74a82e-19ef-414a-a662-1b1b5990affe';

commit;
```

Resultado esperado
- Al iniciar sesión, UserContext encontrará profiles por id=auth.uid() y Auth.tsx podrá redirigir a /operator.

2) Solución definitiva (para que no vuelva a ocurrir al crear nuevos operadores)
La raíz del problema es que hoy “crear usuario” solo crea un profile (pre-registrado) pero NO crea el usuario en Supabase Auth con ese mismo id. Entonces el registro real del usuario termina con un id distinto y choca por email.

La solución correcta es: cuando un admin “crea/invita” un usuario, se debe crear/invitar el usuario en Supabase Auth primero (con service role) y luego crear/actualizar profiles con el MISMO id del auth user.

2.1 Cambios de backend (Edge Function)
Implementación recomendada:
- Reutilizar o reemplazar `supabase/functions/send-user-invitation` para que haga TODO el flujo de forma atómica:
  1) Validar que el solicitante sea admin (leer su profile con auth.uid()).
  2) Crear el usuario en Auth vía Admin API:
     - Opción A (recomendada): `auth.admin.inviteUserByEmail(email, { redirectTo })` o `auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } })`
     - Esto entrega un `user.id` y un `action_link`.
  3) Upsert/insert en `public.profiles` usando id = user.id, email, full_name, role, client_id, is_active.
  4) Si role=operator y viene operator_id: `update public.operators set user_id = user.id where id = operator_id`.
  5) Insert/update en `public.user_invitations` para tracking (pending/sent/etc).
  6) Enviar email por Resend usando el `action_link` real de Supabase (no el link “/auth?tab=register…”), para que el usuario quede autenticado correctamente al aceptar.

Importante:
- Dejaremos de usar el “pre-registro” que crea profiles con UUID random (eso es lo que rompe todo).
- Esto evita para siempre el 23505 + PGRST116.

2.2 Cambios de frontend (User Management)
Archivos principales:
- `src/hooks/useUserManagement.ts`
  - Reemplazar el `rpc('admin_create_user')` + `functions.invoke('send-user-invitation')` por una sola llamada a edge function (ej: `functions.invoke('send-user-invitation', { body: { email, fullName, role, clientId, operatorId } })`) que devuelva el nuevo userId.
  - Luego refrescar users/invitations/operators como hoy.
- `src/components/settings/CreateUserDialog.tsx`
  - Mantener selector “Operador Asociado” (ya existe).
  - Ajustar el copy para indicar que se enviará una invitación real por email.

2.3 Ajustes en /auth (para usuarios invitados)
Dependiendo de cómo quieras que el operador inicie sesión en el futuro, hay 2 caminos (necesito tu confirmación cuando continuemos):
- Opción 1: “Sólo por enlace de invitación” (magic link)
  - El usuario entra desde el email, queda logueado y redirige a /operator automáticamente.
  - Ventaja: implementación más simple.
  - Desventaja: si luego quiere entrar con contraseña, no podrá hasta setear una.
- Opción 2 (recomendada): “Invitación + setear contraseña”
  - Tras aceptar invitación (sesión válida), mostramos una pantalla “Crear contraseña” y hacemos `supabase.auth.updateUser({ password })`.
  - Luego el usuario podrá entrar siempre con email+password (el flujo actual).
  - Implementación:
    - `src/pages/Auth.tsx`: detectar sesión ya iniciada y un flag “invited/needs_password_setup” (podemos basarnos en query param o en una columna en profiles como `needs_password_setup`).
    - Renderizar un formulario simple de set password y al éxito redirigir por rol.

2.4 Corrección defensiva en UserContext (self-heal)
- `src/contexts/UserContext.tsx`
  - Si al crear profile ocurre `23505` (email duplicado), en vez de reintentar 3 veces y quedar en limbo:
    - Mostrar un mensaje claro: “Tu cuenta fue invitada pero aún no está vinculada correctamente. Contacta al admin o reintenta.”
    - Opcional (mejor): llamar a una edge function “repair-profile-link” (admin-only) o “request-repair” (si decides permitir auto-reparación) para arreglar casos antiguos.
  - Esto evita que el usuario vea “login exitoso” pero quede atrapado.

3) Checklist de pruebas (end-to-end)
1. Admin: Settings → Gestión de usuarios → Nuevo usuario → rol “operator” → seleccionar operador asociado.
2. Verificar: llega email de invitación (link de Supabase).
3. Usuario operador: abrir el link y confirmar que:
   - queda autenticado,
   - se crea/usa profile con id=auth.uid(),
   - redirige a /operator.
4. En /operator: confirmar que carga servicios (o al menos no muestra error “No se encontró operador” si está vinculado).
5. (Si eliges opción “set password”): confirmar que puede cerrar sesión y luego entrar con email+password normalmente.

Qué necesito confirmar cuando sigamos (2 preguntas rápidas)
1) ¿Quieres que el operador pueda iniciar sesión con contraseña (email+password) o te sirve que sea sólo por link (magic link)?
2) ¿El email debe salir desde Resend (como ahora) o prefieres usar el email nativo de Supabase?

Ideas siguientes (opcional, después de arreglar el acceso)
- Agregar una pantalla “Cuenta no vinculada” con botón “Reintentar” y soporte (evita confusión).
- Agregar un botón en Gestión de Usuarios: “Reparar vínculo de cuenta” para casos antiguos.
- Registrar un log de auditoría cuando se vincula un operador ↔ usuario (para trazabilidad).
- Agregar “Cambiar contraseña” en Perfil para operadores.
- Pruebas automáticas Playwright para: invitación → set password → login → /operator.
