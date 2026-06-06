-- ============================================================
-- FASE 1 — Reestructuración taxonomía de costos
-- Grúas 5 Norte · Seguro de ejecutar · 100% reversible
-- ============================================================
-- Qué hace esta migración:
--   1. Renombra subcategoría "Pago Revisión Técnica" → "Trámite Rev. Técnica (cliente)"
--      y sincroniza el campo costs.subcategory en registros históricos
--   2. Renombra categoría "Seguros" → "Seguros y Permisos"
--   3. Renombra categoría "Combustible" → "Combustible equipos aux."
--   4. Inserta subcategorías nuevas en Seguros y Permisos, Salarios,
--      Administrativos e Impuestos
--   5. Configura el default_cost_center_id en cada categoría
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. RENOMBRAR subcategoría "Pago Revisión Técnica"
-- ─────────────────────────────────────────────────────────────

UPDATE public.cost_subcategories cs
SET
  name        = 'Trámite Rev. Técnica (cliente)',
  updated_at  = now()
FROM public.cost_categories cc
WHERE cs.category_id = cc.id
  AND cc.name        = 'Gastos de Servicios'
  AND cs.name        = 'Pago Revisión Técnica';

UPDATE public.costs c
SET
  subcategory  = 'Trámite Rev. Técnica (cliente)',
  updated_at   = now()
FROM public.cost_categories cc
WHERE c.category_id  = cc.id
  AND cc.name        = 'Gastos de Servicios'
  AND c.subcategory  = 'Pago Revisión Técnica';


-- ─────────────────────────────────────────────────────────────
-- 2. RENOMBRAR categoría "Seguros" → "Seguros y Permisos"
-- ─────────────────────────────────────────────────────────────

UPDATE public.cost_categories
SET
  name        = 'Seguros y Permisos',
  description = 'Pólizas de seguro, permisos de circulación y revisiones técnicas de la flota',
  updated_at  = now()
WHERE name    = 'Seguros';


-- ─────────────────────────────────────────────────────────────
-- 3. RENOMBRAR categoría "Combustible" → "Combustible equipos aux."
-- ─────────────────────────────────────────────────────────────

UPDATE public.cost_categories
SET
  name        = 'Combustible equipos aux.',
  description = 'Combustible para generadores, herramientas y equipos auxiliares. NO incluye combustible de vehículos en servicio (eso va en Gastos de Servicios).',
  updated_at  = now()
WHERE name    = 'Combustible';


-- ─────────────────────────────────────────────────────────────
-- 4. INSERTAR subcategorías nuevas (idempotente)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_cat_id uuid;
BEGIN

  -- 4a. Seguros y Permisos
  SELECT id INTO v_cat_id
  FROM public.cost_categories
  WHERE name = 'Seguros y Permisos'
  LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories
      (category_id, name, display_order, is_active, requires_supplier, requires_document)
    SELECT v_cat_id, sub.name, sub.ord, true, sub.req_sup, sub.req_doc
    FROM (VALUES
      ('SOAP',                       1, true,  true),
      ('Seguro de carga',            2, true,  true),
      ('Seguro de responsabilidad',  3, true,  true),
      ('Permiso de circulación',     4, false, true),
      ('Revisión técnica (flota)',   5, false, true),
      ('Otros',                      6, false, false)
    ) AS sub(name, ord, req_sup, req_doc)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;

  -- 4b. Salarios
  SELECT id INTO v_cat_id
  FROM public.cost_categories
  WHERE name = 'Salarios'
  LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories
      (category_id, name, display_order, is_active, requires_operator)
    SELECT v_cat_id, sub.name, sub.ord, true, sub.req_op
    FROM (VALUES
      ('Remuneración mensual',    1, false),
      ('Horas extra',             2, true),
      ('Bono producción',         3, true),
      ('Anticipo de sueldo',      4, true),
      ('Liquidación / finiquito', 5, false),
      ('Otros',                   6, false)
    ) AS sub(name, ord, req_op)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;

  -- 4c. Administrativos
  SELECT id INTO v_cat_id
  FROM public.cost_categories
  WHERE name = 'Administrativos'
  LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories
      (category_id, name, display_order, is_active, requires_supplier, requires_document)
    SELECT v_cat_id, sub.name, sub.ord, true, sub.req_sup, sub.req_doc
    FROM (VALUES
      ('Arriendo oficina / bodega', 1, true,  true),
      ('Software y suscripciones',  2, true,  true),
      ('Servicios básicos',         3, true,  true),
      ('Útiles y materiales',       4, false, false),
      ('Comunicaciones',            5, true,  false),
      ('Contabilidad / asesoría',   6, true,  true),
      ('Otros',                     7, false, false)
    ) AS sub(name, ord, req_sup, req_doc)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;

  -- 4d. Impuestos
  SELECT id INTO v_cat_id
  FROM public.cost_categories
  WHERE name = 'Impuestos'
  LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories
      (category_id, name, display_order, is_active, requires_document)
    SELECT v_cat_id, sub.name, sub.ord, true, sub.req_doc
    FROM (VALUES
      ('Patente municipal',      1, true),
      ('Multa de tránsito',      2, true),
      ('IVA no recuperable',     3, true),
      ('Impuesto de timbre',     4, true),
      ('Contribuciones',         5, true),
      ('Otros tributos',         6, false)
    ) AS sub(name, ord, req_doc)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;

  -- 4e. Combustible equipos aux.
  SELECT id INTO v_cat_id
  FROM public.cost_categories
  WHERE name = 'Combustible equipos aux.'
  LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO public.cost_subcategories
      (category_id, name, display_order, is_active)
    SELECT v_cat_id, sub.name, sub.ord, true
    FROM (VALUES
      ('Generador',         1),
      ('Herramientas',      2),
      ('Equipo de trabajo', 3),
      ('Otros',             4)
    ) AS sub(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cost_subcategories
      WHERE category_id = v_cat_id AND name = sub.name
    );
  END IF;

END $$;


-- ─────────────────────────────────────────────────────────────
-- 5. CONFIGURAR default_cost_center_id por categoría
--    Códigos ajustados a los existentes en cost_centers:
--      OPER-SERV → Servicios Cliente (Gastos de Servicios)
--      MANT      → Mantenimiento
--      OPER-GRU  → Operación Grúas (Seguros y Permisos)
--      REMU      → Remuneraciones (Salarios)
--      ADMIN     → Administrativos
--      IPTOS     → Impuestos
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_center_oper_serv  uuid;
  v_center_mant       uuid;
  v_center_oper_gru   uuid;
  v_center_remu       uuid;
  v_center_admin      uuid;
  v_center_iptos      uuid;
BEGIN

  SELECT id INTO v_center_oper_serv FROM public.cost_centers WHERE code = 'OPER-SERV' LIMIT 1;
  SELECT id INTO v_center_mant      FROM public.cost_centers WHERE code = 'MANT'      LIMIT 1;
  SELECT id INTO v_center_oper_gru  FROM public.cost_centers WHERE code = 'OPER-GRU'  LIMIT 1;
  SELECT id INTO v_center_remu      FROM public.cost_centers WHERE code = 'REMU'      LIMIT 1;
  SELECT id INTO v_center_admin     FROM public.cost_centers WHERE code = 'ADMIN'     LIMIT 1;
  SELECT id INTO v_center_iptos     FROM public.cost_centers WHERE code = 'IPTOS'     LIMIT 1;

  -- Gastos de Servicios → OPER-SERV
  IF v_center_oper_serv IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_oper_serv
    WHERE name = 'Gastos de Servicios'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_oper_serv);
  END IF;

  -- Mantenimiento → MANT
  IF v_center_mant IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_mant
    WHERE name = 'Mantenimiento'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_mant);
  END IF;

  -- Seguros y Permisos → OPER-GRU
  IF v_center_oper_gru IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_oper_gru
    WHERE name = 'Seguros y Permisos'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_oper_gru);
  END IF;

  -- Salarios → REMU
  IF v_center_remu IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_remu
    WHERE name = 'Salarios'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_remu);
  END IF;

  -- Administrativos → ADMIN
  IF v_center_admin IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_admin
    WHERE name = 'Administrativos'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_admin);
  END IF;

  -- Impuestos → IPTOS
  IF v_center_iptos IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_iptos
    WHERE name = 'Impuestos'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_iptos);
  ELSIF v_center_admin IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_admin
    WHERE name = 'Impuestos'
      AND default_cost_center_id IS NULL;
  END IF;

  -- Combustible equipos aux. → MANT
  IF v_center_mant IS NOT NULL THEN
    UPDATE public.cost_categories
    SET default_cost_center_id = v_center_mant
    WHERE name = 'Combustible equipos aux.'
      AND (default_cost_center_id IS NULL OR default_cost_center_id != v_center_mant);
  END IF;

END $$;


COMMIT;
