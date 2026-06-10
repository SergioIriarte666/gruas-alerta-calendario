-- Restaurar costos faltantes para el servicio SRV-4107
INSERT INTO public.costs (
  service_id,
  category_id,
  description,
  amount,
  date,
  subcategory,
  service_folio,
  created_at
) VALUES 
-- Combustible $150,000
(
  'cc4b2644-3992-492b-ad19-c79eabdd6bd5',
  '1c3e8ed4-c711-4bc8-bd8a-79c152f51e4b', 
  'Combustible',
  150000,
  '2025-08-01',
  '',
  'SRV-4107',
  '2025-08-01 14:07:54.160599+00'
),
-- Viático $10,000
(
  'cc4b2644-3992-492b-ad19-c79eabdd6bd5',
  '1c3e8ed4-c711-4bc8-bd8a-79c152f51e4b',
  'Viatico', 
  10000,
  '2025-08-01',
  '',
  'SRV-4107',
  '2025-08-01 14:07:54.160599+00'
);