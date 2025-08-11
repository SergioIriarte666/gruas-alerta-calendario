-- Habilitar real-time updates para la tabla costs
ALTER TABLE public.costs REPLICA IDENTITY FULL;

-- Habilitar real-time updates para la tabla services  
ALTER TABLE public.services REPLICA IDENTITY FULL;

-- Agregar las tablas a la publicación de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.costs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;