
-- Step 1: Insert missing categories from supplier_categories into cost_categories
-- Map by name (case-insensitive). Only insert those that don't already exist.
INSERT INTO cost_categories (name, description)
SELECT DISTINCT sc.label, sc.description
FROM supplier_categories sc
WHERE NOT EXISTS (
  SELECT 1 FROM cost_categories cc 
  WHERE LOWER(cc.name) = LOWER(sc.label)
)
AND sc.label IS NOT NULL AND sc.label != '';

-- Step 2: Update supplier_payments.category — replace supplier_categories UUIDs with cost_categories UUIDs
UPDATE supplier_payments sp
SET category = cc.id::text
FROM supplier_categories sc, cost_categories cc
WHERE sp.category = sc.id::text
AND LOWER(cc.name) = LOWER(sc.label);

-- Step 3: Update suppliers.category — replace supplier_categories UUIDs with cost_categories UUIDs  
UPDATE suppliers s
SET category = cc.id::text
FROM supplier_categories sc, cost_categories cc
WHERE s.category = sc.id::text
AND LOWER(cc.name) = LOWER(sc.label);

-- Step 4: Handle legacy string values in supplier_payments.category
-- Map known legacy strings to cost_categories by name match
UPDATE supplier_payments sp
SET category = cc.id::text
FROM cost_categories cc
WHERE sp.category IS NOT NULL
AND sp.category !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND LOWER(cc.name) = LOWER(sp.category);

-- Step 5: Handle legacy string values in suppliers.category
UPDATE suppliers s
SET category = cc.id::text
FROM cost_categories cc
WHERE s.category IS NOT NULL
AND s.category !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND LOWER(cc.name) = LOWER(s.category);
