-- Agregar campo de contacto a la tabla clients
ALTER TABLE public.clients 
ADD COLUMN contact_name text;

-- Agregar comentario para documentar el campo
COMMENT ON COLUMN public.clients.contact_name IS 'Nombre de la persona de contacto en el cliente';