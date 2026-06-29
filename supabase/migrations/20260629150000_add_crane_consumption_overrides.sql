ALTER TABLE public.cranes
ADD COLUMN IF NOT EXISTS fuel_type_override text,
ADD COLUMN IF NOT EXISTS base_consumption_per_km_override numeric,
ADD COLUMN IF NOT EXISTS loaded_consumption_factor_override numeric,
ADD COLUMN IF NOT EXISTS towing_consumption_factor_override numeric;

COMMENT ON COLUMN public.cranes.fuel_type_override IS
'Override opcional del tipo de combustible para el cálculo de viajes.';

COMMENT ON COLUMN public.cranes.base_consumption_per_km_override IS
'Override opcional del consumo base de la grúa en litros por kilómetro.';

COMMENT ON COLUMN public.cranes.loaded_consumption_factor_override IS
'Override opcional del factor de consumo para viaje cargado (1 vehículo).';

COMMENT ON COLUMN public.cranes.towing_consumption_factor_override IS
'Override opcional del factor de consumo para viaje con arrastre (2 vehículos).';

UPDATE public.cranes
SET
  fuel_type_override = 'diesel',
  base_consumption_per_km_override = ROUND((1.0 / 5.7)::numeric, 6),
  loaded_consumption_factor_override = 1.12,
  towing_consumption_factor_override = 1.25,
  updated_at = now()
WHERE license_plate = 'TLYF-23';
