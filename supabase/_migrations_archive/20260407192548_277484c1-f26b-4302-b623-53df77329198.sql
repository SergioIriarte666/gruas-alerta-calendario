
-- Assign SKUs to all inventory_items that currently have no SKU
-- Legitimate products
UPDATE inventory_items SET sku = 'ACE-HID-001' WHERE id = 'fb60c104-f036-46b7-a424-045c375f827f';
UPDATE inventory_items SET sku = 'ACE-HID-002' WHERE id = '062f7f09-5791-4387-af8e-9b90e47d2d2c';
UPDATE inventory_items SET sku = 'ACE-HID-GRU-001' WHERE id = '601933e2-849e-405c-83ce-126a730551f0';
UPDATE inventory_items SET sku = 'ACE-HID-IMP-001' WHERE id = 'c75dd7bb-3cc6-43e3-956d-b4be41edb6bc';
UPDATE inventory_items SET sku = 'ACE-MOT-15W40-001' WHERE id = 'ed853279-eae5-4bc8-8b66-f025f2b87b7f';
UPDATE inventory_items SET sku = 'AMP-12V-H7-001' WHERE id = '6ba083cb-2334-424c-bef2-a5f8b49c4ea3';
UPDATE inventory_items SET sku = 'BOR-BAT-001' WHERE id = '5e4776dd-cfa3-419c-929a-7dc25fa86433';
UPDATE inventory_items SET sku = 'BOT-LEV-001' WHERE id = '03bb0628-3946-4ee0-a4e6-97a6a59b0058';
UPDATE inventory_items SET sku = 'CAB-3/8-001' WHERE id = '98fd72cb-4240-4433-a0d7-af02293e01c9';
UPDATE inventory_items SET sku = 'CAB-3/8-002' WHERE id = 'ca470768-a2b0-4c03-b622-1843f3d2a415';
UPDATE inventory_items SET sku = 'CAB-3/8-20M-001' WHERE id = 'e687cc10-9c0c-4cf2-9fc4-f9e1a37a15ea';
UPDATE inventory_items SET sku = 'CAD-RMP-2828-001' WHERE id = 'c81106d6-4756-42eb-b642-2fe14d9901ca';
UPDATE inventory_items SET sku = 'CAJ-INV-001' WHERE id = '25f8dca1-c369-45f3-9443-a6ba2036c3cb';
UPDATE inventory_items SET sku = 'CUB-VOL-AMP24-001' WHERE id = 'd273148e-c938-4f98-bf40-7b2a250cc762';
UPDATE inventory_items SET sku = 'FIL-ACE-RAC-001' WHERE id = '980e53aa-e814-4af5-b229-2061f73f29dc';
UPDATE inventory_items SET sku = 'FIL-HID-PLT-001' WHERE id = '0660d4f9-4a12-4a0f-9d12-df1412297722';
UPDATE inventory_items SET sku = 'FIL-MNT-EMP-001' WHERE id = '7de97faf-4305-4265-a4f4-7914f191ce67';
UPDATE inventory_items SET sku = 'MAN-HID-001' WHERE id = '6d69250b-ac54-4cf4-a75f-ebe282de0edb';
UPDATE inventory_items SET sku = 'MAN-HID-002' WHERE id = '1a67dba2-d29a-4c3b-8907-7658453d36e2';
UPDATE inventory_items SET sku = 'MAN-HID-003' WHERE id = '17085b83-5ca2-4b4d-984a-f1a8628b5cc2';
UPDATE inventory_items SET sku = 'MAN-HID-004' WHERE id = '082c5d9c-5f0e-4a83-899b-4979c9044a8f';
UPDATE inventory_items SET sku = 'MAN-HID-005' WHERE id = '095d8297-14d3-4c3c-a31f-44901644d5d5';
UPDATE inventory_items SET sku = 'MAN-ADP-001' WHERE id = '73e7e30a-ba16-4b6f-998c-eae072c66577';
UPDATE inventory_items SET sku = 'MAN-ADP-002' WHERE id = '5b6c18bc-9ccc-4f5d-bf38-f3b8f23a926b';
UPDATE inventory_items SET sku = 'MNT-HINO-001' WHERE id = '6f2a1410-3079-4bcd-96d3-61834bcd5c35';
UPDATE inventory_items SET sku = 'MAT-ELE-001' WHERE id = '8d364181-7e93-4af7-a78c-b54696e3395c';
UPDATE inventory_items SET sku = 'NEU-235R17-001' WHERE id = 'ef706220-b62b-4949-961f-9a5cf1539299';
UPDATE inventory_items SET sku = 'NEU-265R17-001' WHERE id = '1e1699c6-d6f0-4b27-8f5e-b633805f8866';
UPDATE inventory_items SET sku = 'ORI-001' WHERE id = 'c6f8cc5b-37c7-4839-862d-685fe6cc89fc';
UPDATE inventory_items SET sku = 'PAR-BRI-001' WHERE id = 'b06b63fd-43d8-438f-9332-13a8c577f3be';
UPDATE inventory_items SET sku = 'PAR-DEL-001' WHERE id = '5f50146e-670e-46c2-a2e4-6ace830f64a1';
UPDATE inventory_items SET sku = 'PAS-BOT-001' WHERE id = '69063239-f589-4809-a3b1-3162762986e5';
UPDATE inventory_items SET sku = 'PAS-BOT-002' WHERE id = '0e865032-f885-43e0-be0d-bb755e13a14c';
UPDATE inventory_items SET sku = 'PUL-SUS-001' WHERE id = '672ff02f-5d21-40e8-8b8a-5cc166446b08';
UPDATE inventory_items SET sku = 'SEG-WHL-001' WHERE id = '1d6cefab-6cbc-4ae7-9069-9eafe7c59cb3';
UPDATE inventory_items SET sku = 'SOQ-AMP-12V-001' WHERE id = '50810d08-a929-45f1-9205-01be7d7bd15a';
UPDATE inventory_items SET sku = 'TER-BAT-001' WHERE id = '98c133e5-a52f-4db5-98f6-95c9b668d896';
UPDATE inventory_items SET sku = 'TER-BAT-002' WHERE id = '8b88611f-8595-4ddc-9758-22c02039e69b';

-- Items with "Compra de inventario:" prefix - SKU based on real product
UPDATE inventory_items SET sku = 'ACE-HID-003' WHERE id = 'a2604e0f-de96-4e22-ab44-dd1f9813fd78';
UPDATE inventory_items SET sku = 'AMP-12V-H7-002' WHERE id = '235d4cd8-a34e-4fdd-9043-f71366bc4e12';
UPDATE inventory_items SET sku = 'BOT-LEV-002' WHERE id = '6bd1cc96-4f50-4edf-a686-84f3b5f2e53e';
UPDATE inventory_items SET sku = 'MAN-ADP-003' WHERE id = '84638536-1229-4281-988c-aba6130ce2d0';
UPDATE inventory_items SET sku = 'NEU-265R17-002' WHERE id = '9d07a97e-c702-487e-a55b-e38ee2eafa6d';

-- Noisy names
UPDATE inventory_items SET sku = 'FAC-OIF-3720-001' WHERE id = '325de5a8-8b8d-4135-b332-b27e35aa1b00';

-- Test items
UPDATE inventory_items SET sku = 'TEST-CONS-001' WHERE id = 'fc4d6784-bf24-4c22-9252-91b074bc11e0';
UPDATE inventory_items SET sku = 'TEST-ADUP-001' WHERE id = 'f6a0c5c1-caeb-476f-bde9-b591837cdb17';
