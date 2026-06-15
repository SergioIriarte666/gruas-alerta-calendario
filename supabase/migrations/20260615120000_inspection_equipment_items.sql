BEGIN;

CREATE TABLE IF NOT EXISTS inspection_equipment_items (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_inspection_equipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inspection_equipment_updated_at
  BEFORE UPDATE ON inspection_equipment_items
  FOR EACH ROW EXECUTE FUNCTION update_inspection_equipment_updated_at();

INSERT INTO inspection_equipment_items (id, name, is_active, sort_order) VALUES
  ('antena',             'Antena',              true,  1),
  ('baliza',             'Baliza',              true,  2),
  ('bateria',            'Batería',             true,  3),
  ('botiquin',           'Botiquín',            true,  4),
  ('caja-invierno',      'Caja Invierno',       true,  5),
  ('cenicero',           'Cenicero',            true,  6),
  ('chaleco-reflectante','Chaleco Reflectante',  true,  7),
  ('cint-seguridad',     'Cint. Seguridad',     true,  8),
  ('consola',            'Consola',             true,  9),
  ('cunas',              'Cuñas',               true, 10),
  ('emblemas',           'Emblemas',            true, 11),
  ('encendedor',         'Encendedor',          true, 12),
  ('espejo-exterior',    'Espejo Exterior',     true, 13),
  ('espejo-interno',     'Espejo Interno',      true, 14),
  ('extintor',           'Extintor',            true, 15),
  ('extintor-10k',       'Extintor 10 K.',      true, 16),
  ('gata',               'Gata',                true, 17),
  ('limp-parab',         'Limp. Parab.',        true, 18),
  ('llave-rueda',        'Llave Rueda',         true, 19),
  ('neblineros',         'Neblineros',          true, 20),
  ('parlantes',          'Parlantes',           true, 21),
  ('pertiga',            'Pertiga',             true, 22),
  ('piso-goma',          'Piso Goma',           true, 23),
  ('radio',              'Radio',               true, 24),
  ('rueda-del-izq',      'Rueda Del Izq.',      true, 25),
  ('rueda-del-der',      'Rueda Del.Der.',      true, 26),
  ('rueda-rpto',         'Rueda Rpto.',         true, 27),
  ('rueda-tra-der',      'Rueda Tra.Der.',      true, 28),
  ('rueda-tra-izq',      'Rueda Tra.Izq.',      true, 29),
  ('sombrilla',          'Sombrilla',           true, 30),
  ('tag',                'TAG',                 true, 31),
  ('tapa-bencina',       'Tapa Bencina',        true, 32),
  ('tapa-radiador',      'Tapa Radiador',       true, 33),
  ('tapa-ruedas',        'Tapa Ruedas',         true, 34),
  ('triangulos',         'Triángulos',          true, 35)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE inspection_equipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read equipment items"
  ON inspection_equipment_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage equipment items"
  ON inspection_equipment_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMIT;
