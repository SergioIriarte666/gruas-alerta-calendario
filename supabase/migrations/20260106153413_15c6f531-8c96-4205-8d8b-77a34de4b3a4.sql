-- Crear ítems de inventario faltantes
INSERT INTO inventory_items (name, unit_of_measure, unit_cost, is_active)
SELECT 'Filtro Hidraulico Plataforma', 'unidad', 30000, true
WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE name ILIKE 'Filtro Hidraulico Plataforma');

INSERT INTO inventory_items (name, unit_of_measure, unit_cost, is_active)
SELECT 'Mangueras Hidraulico', 'unidad', 27140, true
WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE name ILIKE 'Mangueras Hidraulico');

-- Crear movimientos para Aceite Hidraulico (costo: d755a1a4-123f-4499-8948-74cb642173c4)
INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, observations, status, cost_id)
VALUES (
  '062f7f09-5791-4387-af8e-9b90e47d2d2c',
  '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c',
  'entry',
  2,
  46990,
  93980,
  '2026-01-06',
  'Compra con consumo inmediato',
  'Sincronización retroactiva - Compra registrada desde costo',
  'active',
  'd755a1a4-123f-4499-8948-74cb642173c4'
);

INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, observations, status, cost_id, crane_id)
VALUES (
  '062f7f09-5791-4387-af8e-9b90e47d2d2c',
  '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c',
  'exit',
  2,
  46990,
  93980,
  '2026-01-06',
  'Consumo inmediato',
  'Sincronización retroactiva - Consumo a grúa TDCJ-46',
  'active',
  'd755a1a4-123f-4499-8948-74cb642173c4',
  '5d0df63e-9b43-4545-816a-d517e5f9188a'
);

-- Crear movimientos para Filtro Hidraulico Plataforma (costo: 22338c4a-c487-4687-939d-289b860506f3)
INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, observations, status, cost_id)
SELECT 
  i.id,
  '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c',
  'entry',
  1,
  30000,
  30000,
  '2026-01-06',
  'Compra con consumo inmediato',
  'Sincronización retroactiva - Compra registrada desde costo',
  'active',
  '22338c4a-c487-4687-939d-289b860506f3'
FROM inventory_items i WHERE i.name ILIKE 'Filtro Hidraulico Plataforma';

INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, observations, status, cost_id, crane_id)
SELECT 
  i.id,
  '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c',
  'exit',
  1,
  30000,
  30000,
  '2026-01-06',
  'Consumo inmediato',
  'Sincronización retroactiva - Consumo a grúa TDCJ-46',
  'active',
  '22338c4a-c487-4687-939d-289b860506f3',
  '5d0df63e-9b43-4545-816a-d517e5f9188a'
FROM inventory_items i WHERE i.name ILIKE 'Filtro Hidraulico Plataforma';

-- Crear movimientos para Mangueras Hidraulico (costo: e236dfb3-d2cb-40b7-995c-28406f2facb6)
INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, observations, status, cost_id)
SELECT 
  i.id,
  '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c',
  'entry',
  1,
  27140,
  27140,
  '2025-11-19',
  'Compra con consumo inmediato',
  'Sincronización retroactiva - Compra registrada desde costo',
  'active',
  'e236dfb3-d2cb-40b7-995c-28406f2facb6'
FROM inventory_items i WHERE i.name ILIKE 'Mangueras Hidraulico';

INSERT INTO inventory_movements (item_id, location_id, movement_type, quantity, unit_cost, total_cost, movement_date, reason, observations, status, cost_id, crane_id)
SELECT 
  i.id,
  '5e0d4585-2d9e-4aa2-b15b-8f88f5efcf7c',
  'exit',
  1,
  27140,
  27140,
  '2025-11-19',
  'Consumo inmediato',
  'Sincronización retroactiva - Consumo a grúa TLYF-23',
  'active',
  'e236dfb3-d2cb-40b7-995c-28406f2facb6',
  '6ef1b7af-e383-4108-b658-faa11760b930'
FROM inventory_items i WHERE i.name ILIKE 'Mangueras Hidraulico';