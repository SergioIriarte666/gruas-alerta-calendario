
-- 1. Limpiar SKU placeholder del item existente
UPDATE inventory_items
SET sku = NULL, updated_at = now()
WHERE id = '75b7abc4-3909-4559-8cdc-290a406d8189' AND sku = '0';

-- 2. Crear los 3 productos faltantes
WITH new_items AS (
  INSERT INTO inventory_items (name, description, sku, category_id, unit_of_measure, unit_cost, is_active)
  VALUES
    ('Adaptador 8MJ-8MP 90°', 'Creado desde importación XML 850394', NULL, '52868aee-4601-4e75-a9fc-80480b8ded38', 'unidad', 5892, true),
    ('Manguera R2-8 Term. FJX-FJX 90° LT: 2.15 MTS', 'Creado desde importación XML 850394', NULL, '52868aee-4601-4e75-a9fc-80480b8ded38', 'unidad', 30155, true),
    ('Manguera R2-8 Term. FJX-FJX 90° LT: 2.35 MTS', 'Creado desde importación XML 850394', NULL, '52868aee-4601-4e75-a9fc-80480b8ded38', 'unidad', 31837, true)
  RETURNING id, name
)
SELECT * FROM new_items;

-- 3. Re-asignar movimientos al producto correcto
-- Adaptador 8MJ-8MP 90°
UPDATE inventory_movements
SET item_id = (SELECT id FROM inventory_items WHERE name = 'Adaptador 8MJ-8MP 90°' LIMIT 1)
WHERE id IN ('a42ec8f9-a0c9-420b-bcbb-47a43c3d24d9', '6647825e-089e-45c5-b43d-efc34ec01700');

-- Manguera 2.15 MTS
UPDATE inventory_movements
SET item_id = (SELECT id FROM inventory_items WHERE name = 'Manguera R2-8 Term. FJX-FJX 90° LT: 2.15 MTS' LIMIT 1)
WHERE id IN ('76744e51-00af-4e8f-b489-ff614f70b096', '043583e0-b452-4fe8-bc20-40ae3edc48f7');

-- Manguera 2.35 MTS
UPDATE inventory_movements
SET item_id = (SELECT id FROM inventory_items WHERE name = 'Manguera R2-8 Term. FJX-FJX 90° LT: 2.35 MTS' LIMIT 1)
WHERE id IN ('f0e98b27-15aa-482d-b166-7c63086d8814', 'e08f47b4-dedf-4c4f-94d0-7198262a0493');
