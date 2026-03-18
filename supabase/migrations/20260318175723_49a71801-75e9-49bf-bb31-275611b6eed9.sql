-- Normalizar RUT del proveedor original
UPDATE public.inventory_suppliers 
SET rut = '76.762.046-2' 
WHERE id = '83c4643b-c49b-4145-ab9c-83e3d002c9a9';

-- Eliminar el duplicado creado hoy (sin pagos vinculados)
DELETE FROM public.inventory_suppliers 
WHERE id = '20eec5e4-a356-4fb8-bb52-d1e129e74f02';