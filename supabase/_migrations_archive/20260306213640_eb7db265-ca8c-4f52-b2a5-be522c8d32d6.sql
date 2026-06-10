-- Step 1: Delete duplicate supplier_invoices, keeping only the oldest record per (supplier_id, invoice_number)
DELETE FROM supplier_invoices 
WHERE id NOT IN (
  SELECT DISTINCT ON (supplier_id, invoice_number) id 
  FROM supplier_invoices 
  ORDER BY supplier_id, invoice_number, created_at ASC
);

-- Step 2: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_supplier_invoice_unique 
ON supplier_invoices (supplier_id, invoice_number);