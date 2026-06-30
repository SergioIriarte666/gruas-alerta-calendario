BEGIN;

CREATE TEMP TABLE typo_map (
  typo text PRIMARY KEY,
  canonical text
) ON COMMIT DROP;

INSERT INTO typo_map (typo, canonical) VALUES
  ('Custodia Gruas 5 Norte', 'Custodia G5N'),
  ('Custodia Grúas 5 Norte', 'Custodia G5N'),
  ('Taller Gighlino', 'Taller Giglino'),
  ('Taller Ghiglino', 'Taller Giglino'),
  ('Taller Gighino', 'Taller Giglino'),
  ('Giglino', 'Taller Giglino'),
  ('Aeropuerto DDA', 'Aeropuerto Desierto de Atacama'),
  ('Aeropuerto', 'Aeropuerto Desierto de Atacama'),
  ('MDO', 'Mantos de Oro'),
  ('Copiapo', 'Copiapó'),
  ('Callegari Copiapo', 'Callegari'),
  ('Mitta Copiapo', 'Mitta Copiapó'),
  ('Europcar Copiapo', 'Europcar Copiapó'),
  ('Peaje Puerto VIejo', 'Peaje Puerto Viejo'),
  ('Villa Maria', 'Villa María'),
  ('PRT San Damaso', 'PRT San Dámaso'),
  ('Caserones Porteria', 'Caserones Portería'),
  ('Taller Gruas 5 Norte', 'Taller Grúas 5 Norte');

DO $$
DECLARE
  cnt_serv_o int;
  cnt_serv_d int;
  cnt_leg_o int;
  cnt_leg_d int;
BEGIN
  SELECT count(*) INTO cnt_serv_o FROM public.services WHERE TRIM(origin) IN (SELECT typo FROM typo_map);
  SELECT count(*) INTO cnt_serv_d FROM public.services WHERE TRIM(destination) IN (SELECT typo FROM typo_map);
  SELECT count(*) INTO cnt_leg_o FROM public.legacy_services WHERE TRIM(origin) IN (SELECT typo FROM typo_map);
  SELECT count(*) INTO cnt_leg_d FROM public.legacy_services WHERE TRIM(destination) IN (SELECT typo FROM typo_map);

  RAISE NOTICE 'A consolidar: services.origin=%, services.destination=%, legacy.origin=%, legacy.destination=%',
    cnt_serv_o, cnt_serv_d, cnt_leg_o, cnt_leg_d;
END $$;

UPDATE public.services s
SET origin = tm.canonical
FROM typo_map tm
WHERE TRIM(s.origin) = tm.typo;

UPDATE public.services s
SET destination = tm.canonical
FROM typo_map tm
WHERE TRIM(s.destination) = tm.typo;

UPDATE public.legacy_services s
SET origin = tm.canonical
FROM typo_map tm
WHERE TRIM(s.origin) = tm.typo;

UPDATE public.legacy_services s
SET destination = tm.canonical
FROM typo_map tm
WHERE TRIM(s.destination) = tm.typo;

COMMIT;
