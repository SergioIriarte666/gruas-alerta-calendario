BEGIN;

CREATE TABLE public.legacy_service_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        text NOT NULL,
  total_rows      integer NOT NULL DEFAULT 0,
  inserted_rows   integer NOT NULL DEFAULT 0,
  skipped_rows    integer NOT NULL DEFAULT 0,
  period_from     date,
  period_to       date,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.legacy_services (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id           uuid REFERENCES public.legacy_service_imports(id) ON DELETE CASCADE,
  received_at         timestamptz NOT NULL,
  adjuster            text,
  reference           text,
  manual_folio        text,
  expediente          text,
  insurer             text,
  service_type        text,
  vehicle_brand       text,
  vehicle_type        text,
  license_plate       text,
  vin                 text,
  origin              text,
  destination         text,
  crane_label         text,
  operator_label      text,
  subtotal_clp        bigint NOT NULL DEFAULT 0,
  total_clp           bigint NOT NULL DEFAULT 0,
  observations        text,
  year_month          text GENERATED ALWAYS AS (
    EXTRACT(YEAR FROM received_at AT TIME ZONE 'America/Santiago')::integer::text
    || '-'
    || lpad(EXTRACT(MONTH FROM received_at AT TIME ZONE 'America/Santiago')::integer::text, 2, '0')
  ) STORED,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legacy_services_received_at ON public.legacy_services(received_at);
CREATE INDEX idx_legacy_services_year_month  ON public.legacy_services(year_month);
CREATE INDEX idx_legacy_services_insurer     ON public.legacy_services(insurer);
CREATE INDEX idx_legacy_services_operator    ON public.legacy_services(operator_label);
CREATE INDEX idx_legacy_services_crane       ON public.legacy_services(crane_label);
CREATE INDEX idx_legacy_services_type        ON public.legacy_services(service_type);
CREATE INDEX idx_legacy_services_import_id   ON public.legacy_services(import_id);

CREATE UNIQUE INDEX idx_legacy_services_dedupe_per_import
  ON public.legacy_services(import_id, received_at, COALESCE(manual_folio,''), COALESCE(license_plate,''));

ALTER TABLE public.legacy_service_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_services        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_imports_admin_all"
  ON public.legacy_service_imports
  FOR ALL
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

CREATE POLICY "legacy_services_admin_all"
  ON public.legacy_services
  FOR ALL
  USING (public.is_admin_user_safe())
  WITH CHECK (public.is_admin_user_safe());

COMMENT ON TABLE public.legacy_services IS
  'Servicios históricos importados desde plataforma de membresía anterior (2020-2025). Sin vínculo con services, clients, operators ni cranes actuales. Solo análisis y tendencias.';
COMMENT ON TABLE public.legacy_service_imports IS
  'Bitácora de cada importación XLSX de legacy_services.';

COMMIT;
