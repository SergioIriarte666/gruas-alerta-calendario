-- Modificar constraint para permitir cantidades negativas (consumos)
-- Primero eliminar el constraint existente
ALTER TABLE public.crane_parts 
DROP CONSTRAINT IF EXISTS crane_parts_quantity_check;

-- Crear nuevo constraint que permita cantidades negativas (para consumos)
-- Las cantidades positivas son compras, las negativas son consumos
ALTER TABLE public.crane_parts 
ADD CONSTRAINT crane_parts_quantity_check 
CHECK (quantity != 0); -- Permitir positivos y negativos, pero no cero

-- Verificar que el constraint de unit_price siga siendo positivo
-- (Los precios unitarios siempre deben ser positivos, incluso para consumos)