

## Problem Diagnosis

Two issues found:

1. **Root cause of "Error al crear el pago"**: The database trigger `create_cost_from_supplier_payment` contains `COALESCE(NEW.category::uuid, v_maintenance_cat_id)` which tries to cast the text `category` field to UUID. When the XML parser passes a category name like "administrativos", this cast fails with `invalid input syntax for type uuid`.

2. **Duplicate cost creation**: The `XMLDocumentUpload.tsx` component manually creates a cost record after payment creation (lines 300-325), but the trigger already creates one automatically on INSERT. This would produce duplicate costs if the trigger succeeds.

3. **Duplicate triggers**: There are TWO identical triggers on `supplier_payments` that call the same function: `create_cost_from_supplier_payment` and `create_cost_from_supplier_payment_trigger`. One should be removed.

---

## Plan

### Step 1: Fix the trigger function

Update `create_cost_from_supplier_payment()` to resolve the category by name lookup instead of casting to UUID:

```sql
-- Replace: COALESCE(NEW.category::uuid, v_maintenance_cat_id)
-- With: lookup by name, falling back to maintenance category
SELECT id INTO v_category_id FROM cost_categories 
WHERE lower(name) = lower(NEW.category) LIMIT 1;
-- Then use: COALESCE(v_category_id, v_maintenance_cat_id)
```

### Step 2: Remove duplicate trigger

Drop `create_cost_from_supplier_payment_trigger` (keeps the original `create_cost_from_supplier_payment`).

### Step 3: Remove manual cost creation from XMLDocumentUpload

Remove lines 300-325 in `XMLDocumentUpload.tsx` where it manually inserts into `costs` table after payment creation — the trigger handles this automatically. This prevents duplicate cost records.

### Step 4: Fix the RPC error for invoice duplicate check

The console also shows: `structure of query does not match function result type` for `check_invoice_duplicates`. This needs the RPC return type to match the actual query columns (column 4 is `varchar(255)` but function expects `text`). Will inspect and fix this function.

