
-- 1. Crear la tabla 'inspections' para almacenar los datos de las inspecciones pre-servicio.
CREATE TABLE public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES public.operators(id),
    equipment_checklist TEXT[] NOT NULL,
    vehicle_observations TEXT,
    operator_signature TEXT NOT NULL,
    client_name TEXT,
    client_rut TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inspections IS 'Almacena los registros de inspección pre-servicio completados por los operadores.';
COMMENT ON COLUMN public.inspections.equipment_checklist IS 'Array de identificadores de los elementos de equipamiento verificados.';
COMMENT ON COLUMN public.inspections.operator_signature IS 'Nombre completo del operador que realiza la inspección, a modo de firma.';

-- 2. Habilitar Row-Level Security (RLS) para proteger los datos de la tabla.
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- 3. Definir políticas de RLS para controlar el acceso.
-- Los administradores pueden gestionar todas las inspecciones.
CREATE POLICY "Admins can manage all inspections"
ON public.inspections
FOR ALL
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Los operadores pueden crear inspecciones para los servicios que tienen asignados.
CREATE POLICY "Operators can create inspections for their services"
ON public.inspections
FOR INSERT
WITH CHECK (
  (get_user_role(auth.uid()) = 'operator') AND
  (operator_id = get_operator_id_by_user(auth.uid())) AND
  (service_id IN (SELECT s.id FROM public.services s WHERE s.operator_id = get_operator_id_by_user(auth.uid())))
);

-- Los operadores solo pueden ver las inspecciones que ellos mismos han creado.
CREATE POLICY "Operators can view their own inspections"
ON public.inspections
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'operator') AND
  (operator_id = get_operator_id_by_user(auth.uid()))
);
