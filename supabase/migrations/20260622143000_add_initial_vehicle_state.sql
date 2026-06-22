ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS initial_vehicle_state jsonb;

COMMENT ON COLUMN public.inspections.initial_vehicle_state IS
'Estado editable del vehiculo al ingreso: inventario, kilometraje, combustible, llaves y documentacion.';
