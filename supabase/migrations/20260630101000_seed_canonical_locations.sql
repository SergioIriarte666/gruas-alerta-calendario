BEGIN;

INSERT INTO public.saved_locations (name, aliases, category, address)
SELECT * FROM (VALUES
  ('Salfa Freire', ARRAY[]::text[], 'taller', 'Salfa Freire, Copiapo'),
  ('Salfa Norte', ARRAY[]::text[], 'taller', 'Salfa Norte, Copiapo'),
  ('Salfa Vespucio', ARRAY[]::text[], 'taller', 'Salfa Vespucio, Santiago'),
  ('Servimaq', ARRAY[]::text[], 'taller', 'Servimaq, Copiapo'),
  ('Taller Giglino', ARRAY['Taller Gighlino','Taller Ghiglino','Taller Gighino','Giglino'], 'taller', 'Taller Giglino, Copiapo'),
  ('Taller Atacama', ARRAY[]::text[], 'taller', 'Taller Atacama, Copiapo'),
  ('Taller Franklin', ARRAY[]::text[], 'taller', 'Taller Franklin, Copiapo'),
  ('Taller Gruas 5 Norte', ARRAY['Taller Grúas 5 Norte'], 'taller', 'Taller Gruas 5 Norte, Copiapo'),
  ('Kaufmann Cardones', ARRAY[]::text[], 'taller', 'Kaufmann Cardones, Copiapo'),
  ('Kaufmann Copayapu', ARRAY[]::text[], 'taller', 'Kaufmann Copayapu, Copiapo'),
  ('Kaufmann', ARRAY[]::text[], 'taller', 'Kaufmann, Copiapo'),
  ('Tattersall', ARRAY[]::text[], 'taller', 'Tattersall, Copiapo'),
  ('Mitta Copiapo', ARRAY['Mitta Copiapó'], 'taller', 'Mitta, Copiapo'),
  ('Europcar Copiapo', ARRAY['Europcar Copiapó'], 'taller', 'Europcar, Copiapo'),
  ('Avis Megacentro', ARRAY[]::text[], 'taller', 'Avis Megacentro, Copiapo'),
  ('Callegari', ARRAY['Callegari Copiapo','Callegari Copiapó'], 'taller', 'Callegari, Copiapo'),
  ('Depetris', ARRAY[]::text[], 'taller', 'Depetris, Copiapo'),
  ('Clean Car', ARRAY[]::text[], 'taller', 'Clean Car, Copiapo'),
  ('Kinross', ARRAY[]::text[], 'faena', 'Faena Kinross, Atacama'),
  ('Mantos de Oro', ARRAY['MDO'], 'faena', 'Faena Mantos de Oro, Atacama'),
  ('CMM Maricunga', ARRAY[]::text[], 'faena', 'CMM Maricunga, Atacama'),
  ('Salares Norte', ARRAY[]::text[], 'faena', 'Salares Norte, Atacama'),
  ('Caserones Mina', ARRAY[]::text[], 'faena', 'Caserones Mina, Atacama'),
  ('Caserones Porteria', ARRAY['Caserones Portería'], 'faena', 'Caserones Porteria, Atacama'),
  ('Norte Abierto', ARRAY[]::text[], 'faena', 'Norte Abierto, Atacama'),
  ('Minera Franke', ARRAY[]::text[], 'faena', 'Minera Franke, Atacama'),
  ('CAP Totoralillo', ARRAY[]::text[], 'faena', 'CAP Totoralillo, Atacama'),
  ('Custodia G5N', ARRAY['Custodia Gruas 5 Norte','Custodia Grúas 5 Norte'], 'custodia', 'Custodia Gruas 5 Norte, Copiapo'),
  ('Aeropuerto Desierto de Atacama', ARRAY['Aeropuerto DDA','Aeropuerto'], 'aeropuerto', 'Aeropuerto Desierto de Atacama, Copiapo'),
  ('PRT San Damaso', ARRAY['PRT San Dámaso'], 'otro', 'PRT San Damaso, Copiapo'),
  ('Peaje Puerto Viejo', ARRAY['Peaje Puerto VIejo'], 'otro', 'Peaje Puerto Viejo, Atacama'),
  ('Escuela Italiana', ARRAY[]::text[], 'otro', 'Escuela Italiana, Copiapo'),
  ('Villa Maria', ARRAY['Villa María'], 'otro', 'Villa Maria, Copiapo'),
  ('Copiapo', ARRAY['Copiapó'], 'ciudad', 'Copiapo, Atacama, Chile'),
  ('Caldera', ARRAY[]::text[], 'ciudad', 'Caldera, Atacama, Chile'),
  ('Chañaral', ARRAY[]::text[], 'ciudad', 'Chañaral, Atacama, Chile'),
  ('Tierra Amarilla', ARRAY[]::text[], 'ciudad', 'Tierra Amarilla, Atacama, Chile'),
  ('El Salvador', ARRAY[]::text[], 'ciudad', 'El Salvador, Atacama, Chile'),
  ('Santiago', ARRAY[]::text[], 'ciudad', 'Santiago, Chile')
) AS v(name, aliases, category, address)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.saved_locations s
  WHERE lower(s.name) = lower(v.name)
);

COMMIT;
