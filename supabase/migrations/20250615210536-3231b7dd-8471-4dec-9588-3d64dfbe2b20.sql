
-- Paso 1: Promover el usuario de prueba al rol de 'operador'.
-- Este es el usuario que parece estar actualmente en sesión.
UPDATE public.profiles
SET role = 'operator'
WHERE email = 'siriartev@gmail.com';

-- Paso 2: Vincular el registro del operador 'Sergio Iriarte' a la cuenta de usuario de prueba.
-- Se asume que existe un operador con ese nombre.
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM public.profiles WHERE email = 'siriartev@gmail.com';
    IF FOUND THEN
        UPDATE public.operators
        SET user_id = test_user_id
        WHERE name = 'Sergio Iriarte';
    END IF;
END $$;

-- Paso 3: Asignar un servicio 'pendiente' a este operador para pruebas.
-- Esto asegura que haya un servicio visible en el panel del operador.
DO $$
DECLARE
    test_operator_id UUID;
BEGIN
    SELECT id INTO test_operator_id FROM public.operators WHERE name = 'Sergio Iriarte' LIMIT 1;
    IF FOUND THEN
        UPDATE public.services
        SET operator_id = test_operator_id
        WHERE id = (
          SELECT id
          FROM public.services
          WHERE status = 'pending'
          LIMIT 1
        );
    END IF;
END $$;
