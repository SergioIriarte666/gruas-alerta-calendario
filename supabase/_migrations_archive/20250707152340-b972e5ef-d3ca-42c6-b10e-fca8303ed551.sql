-- Agregar columna department a la tabla clients
ALTER TABLE public.clients ADD COLUMN department TEXT;

-- Actualizar clientes existentes con un departamento por defecto
UPDATE public.clients SET department = 'General' WHERE department IS NULL;

-- Hacer la columna NOT NULL después de actualizarla
ALTER TABLE public.clients ALTER COLUMN department SET NOT NULL;

-- Eliminar la restricción de unicidad existente en RUT
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_rut_key;

-- Crear nueva restricción de unicidad para RUT + department
ALTER TABLE public.clients ADD CONSTRAINT clients_rut_department_unique UNIQUE (rut, department);