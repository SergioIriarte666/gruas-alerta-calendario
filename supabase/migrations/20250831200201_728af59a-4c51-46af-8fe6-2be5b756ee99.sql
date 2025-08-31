-- Fase 1: Expansión de Estados para Cliente Especial
-- Añadir nuevos estados de manera compatible (no afecta datos existentes)

-- 1. Expandir enum service_status con nuevos estados
ALTER TYPE service_status ADD VALUE 'quoted';
ALTER TYPE service_status ADD VALUE 'purchase_order_pending';

-- 2. Expandir enum closure_status con nuevos estados  
ALTER TYPE closure_status ADD VALUE 'quoted';
ALTER TYPE closure_status ADD VALUE 'purchase_order_pending';

-- 3. Añadir campo purchase_order_number a servicios
ALTER TABLE public.services 
ADD COLUMN purchase_order_number TEXT;

-- 4. Añadir índice para optimizar búsquedas por purchase_order_number
CREATE INDEX idx_services_purchase_order_number 
ON public.services (purchase_order_number) 
WHERE purchase_order_number IS NOT NULL;

-- 5. Comentarios para documentación
COMMENT ON COLUMN public.services.purchase_order_number IS 'Número de orden de compra del cliente - usado para flujo especial de clientes VIP';

-- 6. Verificar que la migración no afecta datos existentes
-- Los servicios existentes mantienen sus estados actuales
-- Los nuevos campos son opcionales (NULL permitido)