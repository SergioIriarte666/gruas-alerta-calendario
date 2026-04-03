
-- Temporarily disable the trigger that prevents updates on paid costs
ALTER TABLE costs DISABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;

-- Fix the long description and notes for cost associated with folio 389111
UPDATE costs 
SET description = 'MGS Repuestos y Cia. Ltda.',
    notes = 'Factura: 389111 | Archivo XML: 389111.xml'
WHERE id = '3f4f78b0-6742-441f-b5d5-04263711b630';

-- Re-enable the trigger
ALTER TABLE costs ENABLE TRIGGER prevent_non_admin_updates_on_paid_costs_trigger;
