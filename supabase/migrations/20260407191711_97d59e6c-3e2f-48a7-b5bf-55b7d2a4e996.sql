-- Fix supplier_name in inventory_movements: remove concatenated item descriptions
UPDATE inventory_movements 
SET supplier_name = 'MGS Repuestos y Cia. Ltda.'
WHERE supplier_name LIKE 'MGS Repuestos y Cia. Ltda. SILENCIADOR%';