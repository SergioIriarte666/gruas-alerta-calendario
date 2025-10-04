-- Hacer campos opcionales para permitir personal administrativo
ALTER TABLE public.operators 
  ALTER COLUMN license_number DROP NOT NULL,
  ALTER COLUMN exam_expiry DROP NOT NULL;

-- Agregar nuevos campos para diferenciar tipos de personal
ALTER TABLE public.operators 
  ADD COLUMN operator_type text DEFAULT 'crane_operator' CHECK (operator_type IN ('crane_operator', 'administrative')),
  ADD COLUMN department text,
  ADD COLUMN position text;

-- Migrar datos existentes: todos los operadores actuales son operadores de grúa
UPDATE public.operators 
SET operator_type = 'crane_operator' 
WHERE operator_type IS NULL;