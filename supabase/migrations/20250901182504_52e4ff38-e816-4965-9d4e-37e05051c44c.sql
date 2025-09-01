-- Corregir servicios de arriendo de equipos con valores duplicados
-- Actualizar para que el valor sea igual al custody_total_amount (no sumado)

UPDATE public.services 
SET value = custody_total_amount,
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM service_types st 
  WHERE st.id = services.service_type_id 
  AND st.name = 'Arriendo de Equipos'
)
AND custody_total_amount IS NOT NULL 
AND custody_total_amount > 0
AND value != custody_total_amount;