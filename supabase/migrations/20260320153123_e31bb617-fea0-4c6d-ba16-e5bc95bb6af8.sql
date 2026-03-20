-- Add "Deudas y Obligaciones" cost category if not exists
INSERT INTO cost_categories (name, description)
SELECT 'Deudas y Obligaciones', 'Pagos de deudas, cuotas de créditos, obligaciones fiscales y financieras'
WHERE NOT EXISTS (
  SELECT 1 FROM cost_categories WHERE LOWER(name) = LOWER('Deudas y Obligaciones')
);