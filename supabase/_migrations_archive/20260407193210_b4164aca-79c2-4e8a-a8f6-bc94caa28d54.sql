-- 1. Renombrar 5 productos
UPDATE inventory_items SET name = 'Aceite Hidráulico', updated_at = now() WHERE id = 'a2604e0f-de96-4e22-ab44-dd1f9813fd78';
UPDATE inventory_items SET name = 'Ampolleta 12V H7', updated_at = now() WHERE id = '235d4cd8-a34e-4fdd-9043-f71366bc4e12';
UPDATE inventory_items SET name = 'Botella de Levante', updated_at = now() WHERE id = '6bd1cc96-4f50-4edf-a686-84f3b5f2e53e';
UPDATE inventory_items SET name = 'Mangueras y Adaptadores', updated_at = now() WHERE id = '84638536-1229-4281-988c-aba6130ce2d0';
UPDATE inventory_items SET name = 'Neumáticos 265/65/R17', updated_at = now() WHERE id = '9d07a97e-c702-487e-a55b-e38ee2eafa6d';

-- 2. Deshabilitar trigger, limpiar FKs, re-habilitar
ALTER TABLE costs DISABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;
UPDATE crane_parts SET inventory_movement_id = NULL WHERE id IN ('65d3479a-1e38-4583-a69a-4219c50cbf03', '87ea871c-46b0-4c0a-85f2-d9c612ed41ec');
UPDATE costs SET inventory_movement_id = NULL WHERE id = '3bfcf4fe-59fd-40a7-9480-f2b9fc3d9d4e';
ALTER TABLE costs ENABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;

-- 3. Eliminar registros basura
DELETE FROM inventory_movements WHERE item_id = '325de5a8-8b8d-4135-b332-b27e35aa1b00';
DELETE FROM inventory_stock WHERE item_id = '325de5a8-8b8d-4135-b332-b27e35aa1b00';
DELETE FROM inventory_items WHERE id = '325de5a8-8b8d-4135-b332-b27e35aa1b00';

DELETE FROM inventory_movements WHERE item_id = 'fc4d6784-bf24-4c22-9252-91b074bc11e0';
DELETE FROM inventory_stock WHERE item_id = 'fc4d6784-bf24-4c22-9252-91b074bc11e0';
DELETE FROM inventory_items WHERE id = 'fc4d6784-bf24-4c22-9252-91b074bc11e0';

DELETE FROM inventory_movements WHERE item_id = 'f6a0c5c1-caeb-476f-bde9-b591837cdb17';
DELETE FROM inventory_stock WHERE item_id = 'f6a0c5c1-caeb-476f-bde9-b591837cdb17';
DELETE FROM inventory_items WHERE id = 'f6a0c5c1-caeb-476f-bde9-b591837cdb17';