BEGIN;

-- 1. Detecta emails de pruebas para evitar vincularlos a operadores productivos.
-- Patrones sincronizados con TEST_EMAIL_PATTERNS en src/lib/userValidation.ts.
CREATE OR REPLACE FUNCTION public.is_test_user_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_email IS NULL THEN false
    WHEN p_email ILIKE 'pagos@%' THEN true
    WHEN p_email ILIKE '%+test@%' THEN true
    WHEN p_email ILIKE '%@example.%' THEN true
    WHEN p_email ILIKE '%@test.%' THEN true
    WHEN p_email ILIKE 'test%@%' THEN true
    WHEN p_email ILIKE 'prueba%@%' THEN true
    WHEN p_email ILIKE 'demo%@%' THEN true
    WHEN p_email ILIKE 'dummy%@%' THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_test_user_email(text) IS
  'Detecta emails de pruebas para evitar vincularlos a operadores productivos. Patrones sincronizados con TEST_EMAIL_PATTERNS en frontend (src/lib/userValidation.ts).';

-- 2. Bloquea vincular un operador a un profile con email de pruebas.
CREATE OR REPLACE FUNCTION public.prevent_operator_test_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.user_id;

  IF public.is_test_user_email(v_email) THEN
    RAISE EXCEPTION
      'No se puede vincular el operador % al usuario % porque es un email de pruebas. Usa una cuenta productiva.',
      NEW.name, v_email
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_operator_test_user_link ON public.operators;
CREATE TRIGGER trg_prevent_operator_test_user_link
  BEFORE INSERT OR UPDATE OF user_id ON public.operators
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_operator_test_user_link();

-- 3. Audita cada cambio de operators.user_id (before/after) en audit_log.
-- Usa el esquema real de audit_log: table_name, operation, old_data, new_data, user_id, timestamp.
-- No se reutiliza log_audit_changes() porque esa función no captura el valor
-- previo en UPDATE (old_data queda NULL salvo en DELETE).
CREATE OR REPLACE FUNCTION public.audit_operator_user_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
BEGIN
  IF OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_old_email FROM public.profiles WHERE id = OLD.user_id;
  SELECT email INTO v_new_email FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.audit_log (user_id, operation, table_name, old_data, new_data)
  VALUES (
    auth.uid(),
    'operator_user_link_changed',
    'operators',
    jsonb_build_object(
      'operator_id', OLD.id,
      'operator_name', OLD.name,
      'user_id', OLD.user_id,
      'email', v_old_email
    ),
    jsonb_build_object(
      'operator_id', NEW.id,
      'operator_name', NEW.name,
      'user_id', NEW.user_id,
      'email', v_new_email
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_operator_user_id_change ON public.operators;
CREATE TRIGGER trg_audit_operator_user_id_change
  AFTER UPDATE OF user_id ON public.operators
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_operator_user_id_change();

-- 4. RPC para que el formulario de operadores muestre el profile vinculado.
-- profiles solo tiene policy de SELECT propia (profiles_select_own), por lo
-- que un admin no puede leer el profile de otro usuario directamente desde
-- el cliente. Esta función es SECURITY DEFINER y exige rol admin.
CREATE OR REPLACE FUNCTION public.get_operator_linked_profile(p_user_id uuid)
RETURNS TABLE(id uuid, email text, role text, status text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo administradores pueden consultar el profile vinculado de un operador';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.role::text, p.status, p.full_name
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_operator_linked_profile(uuid) IS
  'Devuelve email/rol/estado del profile vinculado a un operador. Solo admin. Usado por OperatorForm para mostrar el bloque "Usuario vinculado".';

COMMIT;
