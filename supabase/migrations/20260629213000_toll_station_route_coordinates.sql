UPDATE public.toll_stations
SET
  latitude = data.latitude,
  longitude = data.longitude
FROM (
  VALUES
    ('b1000000-0000-0000-0000-000000000001'::uuid, -33.2355983::numeric, -70.7590362::numeric),
    ('b1000000-0000-0000-0000-000000000002'::uuid, -32.8432749::numeric, -70.9893185::numeric),
    ('b1000000-0000-0000-0000-000000000003'::uuid, -32.2284750::numeric, -71.5085360::numeric),
    ('b1000000-0000-0000-0000-000000000004'::uuid, -32.6423730::numeric, -71.2308880::numeric),
    ('b1000000-0000-0000-0000-000000000005'::uuid, -30.8567640::numeric, -71.5985430::numeric),
    ('b1000000-0000-0000-0000-000000000006'::uuid, -30.5947401::numeric, -71.1562727::numeric),
    ('b1000000-0000-0000-0000-000000000007'::uuid, -30.7098088::numeric, -71.4906961::numeric),
    ('b1000000-0000-0000-0000-000000000008'::uuid, -30.3515810::numeric, -71.4294403::numeric),
    ('b1000000-0000-0000-0000-000000000009'::uuid, -29.0866362::numeric, -70.9173852::numeric),
    ('b1000000-0000-0000-0000-000000000010'::uuid, -29.3713954::numeric, -71.0731165::numeric),
    ('b1000000-0000-0000-0000-000000000011'::uuid, -28.2447710::numeric, -70.6921350::numeric),
    ('b1000000-0000-0000-0000-000000000012'::uuid, -27.4948280::numeric, -70.3991780::numeric)
) AS data(id, latitude, longitude)
WHERE toll_stations.id = data.id;

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
  ts.latitude,
  ts.longitude,
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
