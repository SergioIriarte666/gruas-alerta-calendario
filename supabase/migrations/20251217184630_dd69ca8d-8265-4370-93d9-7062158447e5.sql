-- Fix commission trigger: service_resources column is `role` (not `operator_role`)
-- This was blocking emergency_close_service when status changes to completed.

CREATE OR REPLACE FUNCTION public.generate_commission_on_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_category_id uuid;
  v_operator record;
  v_existing_commission uuid;
  -- IDs de operadores Iriarte excluidos del sistema de comisiones
  v_excluded_operators uuid[] := ARRAY[
    '4e0077b0-1786-4832-9acf-44e5a7702d55'::uuid, -- Jorge Iriarte
    '63d9636c-4ef7-4e62-90ab-abcff11b00fa'::uuid, -- Jorge Ignacio Iriarte
    'fd13ec43-7da5-4da9-a06c-c8648e817d1a'::uuid  -- Sergio Iriarte
  ];
BEGIN
  -- Solo procesar si el servicio cambió a 'completed' y tiene comisión asignada
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.operator_commission IS NOT NULL
     AND NEW.operator_commission > 0 THEN

    -- Obtener el ID de la categoría "Comisión Operador"
    SELECT id INTO v_commission_category_id
    FROM cost_categories
    WHERE name = 'Comisión Operador';

    IF v_commission_category_id IS NULL THEN
      RAISE WARNING 'Categoría "Comisión Operador" no encontrada';
      RETURN NEW;
    END IF;

    -- Para cada operador principal del servicio (excluyendo Iriarte)
    FOR v_operator IN
      SELECT sr.operator_id
      FROM service_resources sr
      WHERE sr.service_id = NEW.id
        AND sr.role = 'Principal'
        AND sr.operator_id IS NOT NULL
        AND sr.operator_id != ALL(v_excluded_operators) -- Excluir Iriarte
    LOOP
      -- Verificar si ya existe comisión para este operador y servicio
      SELECT id INTO v_existing_commission
      FROM costs
      WHERE service_id = NEW.id
        AND operator_id = v_operator.operator_id
        AND category_id = v_commission_category_id;

      -- Si no existe, crear la comisión
      IF v_existing_commission IS NULL THEN
        INSERT INTO costs (
          date,
          description,
          amount,
          category_id,
          subcategory,
          operator_id,
          service_id,
          service_folio
        ) VALUES (
          NEW.service_date,
          'Comisión por servicio ' || NEW.folio,
          NEW.operator_commission,
          v_commission_category_id,
          'comisiones',
          v_operator.operator_id,
          NEW.id,
          NEW.folio
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;