-- Agregar foreign key constraint para crane_parts.cost_id -> costs.id
-- Esto permitirá que las consultas de Supabase con relaciones automáticas funcionen correctamente

ALTER TABLE public.crane_parts 
ADD CONSTRAINT fk_crane_parts_cost_id 
FOREIGN KEY (cost_id) REFERENCES public.costs(id) ON DELETE CASCADE;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_crane_parts_cost_id ON public.crane_parts(cost_id);