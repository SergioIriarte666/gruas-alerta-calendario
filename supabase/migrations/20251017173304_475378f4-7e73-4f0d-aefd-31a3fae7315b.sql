-- FASE 5: Habilitar Real-time en Base de Datos
-- Objetivo: Asegurar que las tablas tengan replicación completa para tiempo real

-- Habilitar REPLICA IDENTITY FULL para capturar todos los cambios
ALTER TABLE public.crane_parts REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_movements REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_items REPLICA IDENTITY FULL;

-- Agregar tablas a publicación de realtime (verificar si ya existen primero)
DO $$
BEGIN
  -- Crane parts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'crane_parts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crane_parts;
  END IF;
  
  -- Inventory movements
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'inventory_movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
  END IF;
  
  -- Inventory items
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'inventory_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
  END IF;
END $$;