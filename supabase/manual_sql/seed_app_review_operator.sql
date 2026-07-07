-- Seed manual para App Review / TestFlight
-- Objetivo:
-- 1. Vincular un usuario Auth existente como operador aprobador
-- 2. Asegurar profile + user_roles + operator
-- 3. Crear un servicio de prueba visible en la app operador
--
-- Uso recomendado:
-- A. Primero crear el usuario en Supabase Auth > Users
--    Email sugerido: apple.review.operator@gruas5norte.cl
--    Password sugerida: definir una temporal y guardarla para App Review
--    Confirmar el email al crear el usuario
--
-- B. Luego ejecutar este script en SQL Editor.
--
-- C. Finalmente usar en App Store Connect:
--    - Nombre de usuario: el email configurado abajo
--    - Contraseña: la que definiste al crear el usuario Auth

DO $$
DECLARE
  v_review_email text := 'apple.review.operator@gruas5norte.cl';
  v_full_name text := 'Apple Review Operador';
  v_phone text := '+56900000000';
  v_operator_rut text := '99999999-9';
  v_operator_id uuid;
  v_user_id uuid;
  v_client_id uuid;
  v_service_type_id uuid;
  v_service_id uuid;
  v_service_folio text;
  v_has_tracking_enabled boolean;
BEGIN
  -- 1) Buscar usuario Auth existente
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE email = v_review_email
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'No existe usuario Auth para %. Crealo primero en Supabase Auth > Users y luego vuelve a ejecutar este script.',
      v_review_email;
  END IF;

  -- 2) Upsert de profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    status,
    phone,
    company,
    rut,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_review_email,
    v_full_name,
    'operator',
    true,
    'approved',
    v_phone,
    'Gruas 5 Norte',
    v_operator_rut,
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE
  SET
    id = EXCLUDED.id,
    full_name = EXCLUDED.full_name,
    role = 'operator',
    is_active = true,
    status = 'approved',
    phone = EXCLUDED.phone,
    company = EXCLUDED.company,
    rut = EXCLUDED.rut,
    updated_at = now();

  -- 3) Asegurar rol operator en user_roles
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_user_id
      AND role = 'operator'
  ) THEN
    INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
    VALUES (v_user_id, 'operator', v_user_id, now());
  END IF;

  -- 4) Asegurar cliente de prueba
  SELECT id
  INTO v_client_id
  FROM public.clients
  WHERE rut = '11111111-1'
    AND department = 'App Review'
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      name,
      rut,
      phone,
      email,
      address,
      is_active,
      created_by,
      department,
      contact_name,
      billing_type,
      display_name
    )
    VALUES (
      'Cliente Prueba App Review',
      '11111111-1',
      v_phone,
      v_review_email,
      'Copiapo, Chile',
      true,
      v_user_id,
      'App Review',
      'Apple Review',
      'standard',
      'Cliente Prueba App Review'
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- 5) Asegurar tipo de servicio de prueba
  SELECT id
  INTO v_service_type_id
  FROM public.service_types
  WHERE name = 'Servicio Test App Review'
  LIMIT 1;

  IF v_service_type_id IS NULL THEN
    INSERT INTO public.service_types (
      name,
      description,
      base_price,
      is_active,
      created_by,
      vehicle_info_optional,
      purchase_order_required,
      origin_required,
      destination_required,
      crane_required,
      operator_required,
      vehicle_brand_required,
      vehicle_model_required,
      license_plate_required,
      is_outsourced
    )
    VALUES (
      'Servicio Test App Review',
      'Servicio de muestra para revision Apple y pruebas internas.',
      45000,
      true,
      v_user_id,
      true,
      false,
      true,
      true,
      false,
      true,
      false,
      false,
      false,
      false
    )
    RETURNING id INTO v_service_type_id;
  END IF;

  -- 6) Asegurar operador vinculado al usuario Auth
  SELECT id
  INTO v_operator_id
  FROM public.operators
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    SELECT id
    INTO v_operator_id
    FROM public.operators
    WHERE rut = v_operator_rut
    LIMIT 1;
  END IF;

  IF v_operator_id IS NULL THEN
    INSERT INTO public.operators (
      name,
      rut,
      phone,
      license_number,
      is_active,
      created_by,
      created_at,
      updated_at,
      user_id,
      operator_type,
      department,
      position,
      commission_exempt
    )
    VALUES (
      v_full_name,
      v_operator_rut,
      v_phone,
      'APP-REVIEW-001',
      true,
      v_user_id,
      now(),
      now(),
      v_user_id,
      'crane_operator',
      'Operaciones',
      'Operador de prueba',
      false
    )
    RETURNING id INTO v_operator_id;
  ELSE
    UPDATE public.operators
    SET
      name = v_full_name,
      phone = v_phone,
      user_id = v_user_id,
      is_active = true,
      operator_type = 'crane_operator',
      department = 'Operaciones',
      position = 'Operador de prueba',
      updated_at = now()
    WHERE id = v_operator_id;
  END IF;

  -- 7) Habilitar tracking si la columna existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'operators'
      AND column_name = 'tracking_enabled'
  )
  INTO v_has_tracking_enabled;

  IF v_has_tracking_enabled THEN
    EXECUTE $sql$
      UPDATE public.operators
      SET tracking_enabled = true
      WHERE id = $1
    $sql$
    USING v_operator_id;
  END IF;

  -- 8) Reutilizar ultimo servicio de prueba si ya existe, para no crear ruido
  SELECT s.id, s.folio
  INTO v_service_id, v_service_folio
  FROM public.services s
  WHERE s.operator_id = v_operator_id
    AND s.observations = 'APP_REVIEW_TEST'
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- 9) Crear servicio de prueba si no existe
  IF v_service_id IS NULL THEN
    v_service_folio := public.generate_service_folio();

    INSERT INTO public.services (
      folio,
      request_date,
      service_date,
      client_id,
      purchase_order,
      vehicle_brand,
      vehicle_model,
      license_plate,
      origin,
      destination,
      service_type_id,
      value,
      crane_id,
      operator_id,
      operator_commission,
      status,
      observations,
      created_by,
      created_at,
      updated_at,
      contact_person,
      contact_phone,
      urgency
    )
    VALUES (
      v_service_folio,
      current_date,
      current_date,
      v_client_id,
      'APP-REVIEW-PO',
      'Toyota',
      'Hilux',
      'TEST-01',
      'Taller Gruas 5 Norte',
      'Ruta 5 Norte, Copiapo',
      v_service_type_id,
      45000,
      NULL,
      v_operator_id,
      0,
      'pending',
      'APP_REVIEW_TEST',
      v_user_id,
      now(),
      now(),
      'Apple Review',
      v_phone,
      'normal'
    )
    RETURNING id INTO v_service_id;
  END IF;

  -- 10) Asegurar relacion en service_resources
  IF NOT EXISTS (
    SELECT 1
    FROM public.service_resources
    WHERE service_id = v_service_id
      AND operator_id = v_operator_id
  ) THEN
    INSERT INTO public.service_resources (
      service_id,
      operator_id,
      crane_id,
      commission_amount,
      resource_type,
      is_primary,
      created_at,
      updated_at,
      created_by,
      role
    )
    VALUES (
      v_service_id,
      v_operator_id,
      NULL,
      0,
      'operator',
      true,
      now(),
      now(),
      v_user_id,
      'Principal'
    );
  END IF;

  RAISE NOTICE 'App Review listo. User ID: %, Operator ID: %, Service ID: %, Folio: %',
    v_user_id, v_operator_id, v_service_id, v_service_folio;
END
$$;

-- Resumen util para copiar en App Store Connect
SELECT
  p.email AS review_login_email,
  p.full_name AS review_operator_name,
  o.id AS operator_id,
  s.folio AS test_service_folio,
  s.status AS test_service_status,
  s.service_date AS test_service_date
FROM public.profiles p
JOIN public.operators o
  ON o.user_id = p.id
LEFT JOIN LATERAL (
  SELECT folio, status, service_date
  FROM public.services
  WHERE operator_id = o.id
    AND observations = 'APP_REVIEW_TEST'
  ORDER BY created_at DESC
  LIMIT 1
) s ON true
WHERE p.email = 'apple.review.operator@gruas5norte.cl';
