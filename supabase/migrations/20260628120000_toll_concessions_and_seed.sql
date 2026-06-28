-- 1. Tabla de concesiones MOP
CREATE TABLE IF NOT EXISTS public.toll_concessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  route text NOT NULL,
  direction text NOT NULL DEFAULT 'BOTH'
    CHECK (direction IN ('NORTH', 'SOUTH', 'BOTH')),
  km_start numeric,
  km_end numeric,
  pdf_url text,
  valid_from date NOT NULL,
  valid_until date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.toll_concessions IS
  'Concesiones de peajes MOP Chile. Cada concesion agrupa una o mas plazas de peaje.';

DROP TRIGGER IF EXISTS trg_toll_concessions_updated_at ON public.toll_concessions;
CREATE TRIGGER trg_toll_concessions_updated_at
  BEFORE UPDATE ON public.toll_concessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Modificar toll_stations
ALTER TABLE public.toll_stations
  ADD COLUMN IF NOT EXISTS concession_id uuid REFERENCES public.toll_concessions(id),
  ADD COLUMN IF NOT EXISTS station_type text NOT NULL DEFAULT 'TRONCAL'
    CHECK (station_type IN ('TRONCAL', 'LATERAL', 'ACCESO')),
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS direction_bound text DEFAULT 'BOTH'
    CHECK (direction_bound IN ('NORTH', 'SOUTH', 'BOTH'));

CREATE INDEX IF NOT EXISTS idx_toll_stations_concession
  ON public.toll_stations(concession_id);

-- 3. RLS para toll_concessions
ALTER TABLE public.toll_concessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS toll_concessions_select_auth ON public.toll_concessions;
CREATE POLICY toll_concessions_select_auth
  ON public.toll_concessions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS toll_concessions_insert_admin ON public.toll_concessions;
CREATE POLICY toll_concessions_insert_admin
  ON public.toll_concessions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user_safe());

DROP POLICY IF EXISTS toll_concessions_update_admin ON public.toll_concessions;
CREATE POLICY toll_concessions_update_admin
  ON public.toll_concessions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

DROP POLICY IF EXISTS toll_concessions_delete_admin ON public.toll_concessions;
CREATE POLICY toll_concessions_delete_admin
  ON public.toll_concessions
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user_safe());

-- 4. Seed Ruta 5 Norte
INSERT INTO public.toll_concessions
  (id, name, route, direction, km_start, km_end, pdf_url, valid_from)
VALUES
  (
    'c1000000-0000-0000-0000-000000000001',
    'Santiago - Los Vilos',
    'Ruta 5 Norte', 'BOTH', 0, 229,
    'https://concesiones.mop.gob.cl/uploads/sites/4/2026/05/STGO-LOS-VILOS.pdf',
    '2026-01-01'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'Los Vilos - La Serena',
    'Ruta 5 Norte', 'BOTH', 229, 472,
    'https://concesiones.mop.gob.cl/uploads/sites/4/2026/01/LOS-VILOS-LA-SERENA.pdf',
    '2026-01-01'
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'La Serena - Vallenar',
    'Ruta 5 Norte', 'BOTH', 472, 653,
    'https://concesiones.mop.gob.cl/uploads/sites/4/2026/01/LA-SERENA-VALLENAR.pdf',
    '2026-01-01'
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'Vallenar - Caldera',
    'Ruta 5 Norte', 'BOTH', 653, 840,
    'https://concesiones.mop.gob.cl/uploads/sites/4/2026/03/VALLENAR-CALDERA.pdf',
    '2026-01-01'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  route = EXCLUDED.route,
  direction = EXCLUDED.direction,
  km_start = EXCLUDED.km_start,
  km_end = EXCLUDED.km_end,
  pdf_url = EXCLUDED.pdf_url,
  valid_from = EXCLUDED.valid_from,
  valid_until = EXCLUDED.valid_until,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active;

INSERT INTO public.toll_stations
  (id, name, location, highway, station_type, concession_id, km_marker, is_active)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Lampa', 'Lampa', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000001', 37, true),
  ('b1000000-0000-0000-0000-000000000002', 'Las Vegas', 'Las Vegas', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000001', 104, true),
  ('b1000000-0000-0000-0000-000000000003', 'Pichidangui', 'Pichidangui', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000001', 185, true),
  ('b1000000-0000-0000-0000-000000000004', 'Tunel El Melon', 'El Melon', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000001', 209, true),
  ('b1000000-0000-0000-0000-000000000005', 'Los Vilos-La Serena Troncal', 'Troncal', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000002', 350, true),
  ('b1000000-0000-0000-0000-000000000006', 'Combarbala (Lateral)', 'Combarbala', 'Ruta 5 Norte', 'LATERAL', 'c1000000-0000-0000-0000-000000000002', 280, true),
  ('b1000000-0000-0000-0000-000000000007', 'Ovalle (Lateral)', 'Ovalle', 'Ruta 5 Norte', 'LATERAL', 'c1000000-0000-0000-0000-000000000002', 310, true),
  ('b1000000-0000-0000-0000-000000000008', 'Tongoy/Guanaqueros (Lateral)', 'Tongoy', 'Ruta 5 Norte', 'LATERAL', 'c1000000-0000-0000-0000-000000000002', 440, true),
  ('b1000000-0000-0000-0000-000000000009', 'Cachiyuyo', 'Cachiyuyo', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000003', 530, true),
  ('b1000000-0000-0000-0000-000000000010', 'Punta Colorada', 'Punta Colorada', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000003', 600, true),
  ('b1000000-0000-0000-0000-000000000011', 'Puerto Viejo', 'Puerto Viejo', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000004', 700, true),
  ('b1000000-0000-0000-0000-000000000012', 'Totoral', 'Totoral', 'Ruta 5 Norte', 'TRONCAL', 'c1000000-0000-0000-0000-000000000004', 790, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  highway = EXCLUDED.highway,
  station_type = EXCLUDED.station_type,
  concession_id = EXCLUDED.concession_id,
  km_marker = EXCLUDED.km_marker,
  is_active = EXCLUDED.is_active;

DELETE FROM public.toll_rates
WHERE toll_station_id IN (
  'b1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000004',
  'b1000000-0000-0000-0000-000000000005',
  'b1000000-0000-0000-0000-000000000006',
  'b1000000-0000-0000-0000-000000000007',
  'b1000000-0000-0000-0000-000000000008',
  'b1000000-0000-0000-0000-000000000009',
  'b1000000-0000-0000-0000-000000000010',
  'b1000000-0000-0000-0000-000000000011',
  'b1000000-0000-0000-0000-000000000012'
)
AND valid_from = DATE '2026-01-01'
AND vehicle_category IN ('LIVIANO', 'CAMION_2_EJES', 'CAMION_PESADO');

INSERT INTO public.toll_rates
  (toll_station_id, vehicle_category, rate_amount, valid_from, is_active)
SELECT s.id, v.cat, v.amount, DATE '2026-01-01', true
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000004')
) AS st(sid)
CROSS JOIN (VALUES
  ('LIVIANO', 900::numeric),
  ('CAMION_2_EJES', 2900::numeric),
  ('CAMION_PESADO', 5300::numeric)
) AS v(cat, amount)
JOIN public.toll_stations s ON s.id::text = st.sid;

INSERT INTO public.toll_rates
  (toll_station_id, vehicle_category, rate_amount, valid_from, is_active)
VALUES
  ('b1000000-0000-0000-0000-000000000005', 'LIVIANO', 4250, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000005', 'CAMION_2_EJES', 7600, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000005', 'CAMION_PESADO', 13550, '2026-01-01', true);

INSERT INTO public.toll_rates
  (toll_station_id, vehicle_category, rate_amount, valid_from, is_active)
SELECT s.id, v.cat, v.amount, DATE '2026-01-01', true
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000006'),
  ('b1000000-0000-0000-0000-000000000007'),
  ('b1000000-0000-0000-0000-000000000008')
) AS st(sid)
CROSS JOIN (VALUES
  ('LIVIANO', 1100::numeric),
  ('CAMION_2_EJES', 2000::numeric),
  ('CAMION_PESADO', 3500::numeric)
) AS v(cat, amount)
JOIN public.toll_stations s ON s.id::text = st.sid;

INSERT INTO public.toll_rates
  (toll_station_id, vehicle_category, rate_amount, valid_from, is_active)
SELECT s.id, v.cat, v.amount, DATE '2026-01-01', true
FROM (VALUES
  ('b1000000-0000-0000-0000-000000000009'),
  ('b1000000-0000-0000-0000-000000000010')
) AS st(sid)
CROSS JOIN (VALUES
  ('LIVIANO', 3150::numeric),
  ('CAMION_2_EJES', 9400::numeric),
  ('CAMION_PESADO', 12500::numeric)
) AS v(cat, amount)
JOIN public.toll_stations s ON s.id::text = st.sid;

INSERT INTO public.toll_rates
  (toll_station_id, vehicle_category, rate_amount, valid_from, is_active)
VALUES
  ('b1000000-0000-0000-0000-000000000011', 'LIVIANO', 1750, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000011', 'CAMION_2_EJES', 5200, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000011', 'CAMION_PESADO', 6900, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000012', 'LIVIANO', 2900, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000012', 'CAMION_2_EJES', 8650, '2026-01-01', true),
  ('b1000000-0000-0000-0000-000000000012', 'CAMION_PESADO', 11550, '2026-01-01', true);

-- 5. Vista helper
CREATE OR REPLACE VIEW public.toll_rates_current AS
SELECT
  tc.name AS concession_name,
  tc.route,
  tc.valid_from AS concession_valid_from,
  tc.valid_until AS concession_valid_until,
  ts.name AS station_name,
  ts.highway,
  ts.station_type,
  ts.km_marker,
  tr.vehicle_category,
  tr.rate_amount,
  tr.valid_from AS rate_valid_from,
  tr.valid_until AS rate_valid_until,
  tr.id AS rate_id,
  ts.id AS station_id,
  tc.id AS concession_id
FROM public.toll_rates tr
JOIN public.toll_stations ts ON ts.id = tr.toll_station_id
JOIN public.toll_concessions tc ON tc.id = ts.concession_id
WHERE tr.is_active = true
  AND tc.is_active = true
  AND ts.is_active = true
  AND tr.valid_from <= CURRENT_DATE
  AND (tr.valid_until IS NULL OR tr.valid_until >= CURRENT_DATE);

GRANT SELECT ON public.toll_rates_current TO authenticated;
