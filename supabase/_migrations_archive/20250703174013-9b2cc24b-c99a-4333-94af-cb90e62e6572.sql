-- Actualizar costos con descripciones con IDs aleatorios a descripciones legibles
UPDATE public.costs 
SET description = CASE 
  WHEN subcategory = 'Combustible' THEN 
    'Combustible ' || to_char(date::date, 'DD/MM/YYYY') || ' ' || 
    to_char(created_at, 'HH24:MI') ||
    CASE WHEN service_folio IS NOT NULL THEN ' - ' || service_folio ELSE '' END
  WHEN subcategory = 'Peajes' THEN 
    'Peajes ' || to_char(date::date, 'DD/MM/YYYY') || ' ' || 
    to_char(created_at, 'HH24:MI') ||
    CASE WHEN service_folio IS NOT NULL THEN ' - ' || service_folio ELSE '' END
  WHEN subcategory = 'Otros' THEN 
    'Otros gastos ' || to_char(date::date, 'DD/MM/YYYY') || ' ' || 
    to_char(created_at, 'HH24:MI') ||
    CASE WHEN service_folio IS NOT NULL THEN ' - ' || service_folio ELSE '' END
  ELSE description
END,
updated_at = now()
WHERE description ~ '#[0-9a-zA-Z]+-[a-zA-Z0-9]+$' 
  AND subcategory IN ('Combustible', 'Peajes', 'Otros');