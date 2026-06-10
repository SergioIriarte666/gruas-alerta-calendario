
-- Habilitar la replicación para las tablas principales.
-- Esto es necesario para que la base de datos capture los datos completos en cada cambio.
ALTER TABLE public.services REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.costs REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;

-- Agregar las tablas a la publicación de Supabase Realtime.
-- Esto permitirá que los cambios en estas tablas se transmitan a la aplicación en tiempo real.
ALTER PUBLICATION supabase_realtime ADD TABLE public.services, public.invoices, public.costs, public.clients;
