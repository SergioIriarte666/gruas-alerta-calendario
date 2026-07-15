BEGIN;

-- Caché compartida de razón social por RUT. No acoplada a Lowboy: cualquier
-- módulo (proveedores, clientes) puede reutilizarla. Evita consultar dos veces
-- el mismo RUT contra APIs con cuota (sre.cl / ruts.info vía edge sre-lookup).
CREATE TABLE IF NOT EXISTS public.rut_directory (
  rut          text PRIMARY KEY,                 -- formato normalizado XX.XXX.XXX-D
  razon_social text NOT NULL,
  source       text NOT NULL CHECK (source IN ('sre_lookup', 'rcv_import', 'manual')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rut_directory IS
  'Caché de razón social por RUT (clave normalizada XX.XXX.XXX-D). source: sre_lookup (API), rcv_import (dato ya presente en el RCV), manual.';

ALTER TABLE public.rut_directory ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado (la caché es de solo consulta para viewers).
DROP POLICY IF EXISTS rut_directory_read ON public.rut_directory;
CREATE POLICY rut_directory_read ON public.rut_directory
  FOR SELECT TO authenticated
  USING (true);

-- Escritura (insert/update/delete): solo admin, mismo helper que el resto del repo.
DROP POLICY IF EXISTS rut_directory_admin_all ON public.rut_directory;
CREATE POLICY rut_directory_admin_all ON public.rut_directory
  FOR ALL TO public
  USING (is_admin_user_safe())
  WITH CHECK (is_admin_user_safe());

-- Semilla a costo cero: poblar desde los nombres que YA tenemos en el RCV.
-- DISTINCT ON toma un nombre determinístico por RUT (el más reciente).
INSERT INTO public.rut_directory (rut, razon_social, source)
SELECT DISTINCT ON (counterpart_rut)
  counterpart_rut, counterpart_name, 'rcv_import'
FROM public.sii_rcv_records
WHERE counterpart_name IS NOT NULL AND btrim(counterpart_name) <> ''
ORDER BY counterpart_rut, created_at DESC NULLS LAST
ON CONFLICT (rut) DO NOTHING;

COMMIT;
