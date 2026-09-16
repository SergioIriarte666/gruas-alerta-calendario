BEGIN;

-- One company timezone for frontend, RPCs, triggers, defaults and reports.
-- This migration changes calculations, never rewrites historical document dates.
CREATE OR REPLACE FUNCTION public.business_timezone()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT c.report_timezone FROM public.company_data c
     JOIN pg_catalog.pg_timezone_names z ON z.name = c.report_timezone LIMIT 1),
    'America/Santiago'
  );
$$;

CREATE OR REPLACE FUNCTION public.business_date(value timestamptz)
RETURNS date LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT (value AT TIME ZONE public.business_timezone())::date;
$$;

CREATE OR REPLACE FUNCTION public.business_today()
RETURNS date LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT public.business_date(CURRENT_TIMESTAMP);
$$;

-- Preserve existing function signatures, grants, security modes and recent fixes.
-- Only SQL/plpgsql functions owned by this application (not extension members).
DO $migration$
DECLARE
  item record;
  original text;
  revised text;
BEGIN
  FOR item IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND l.lanname IN ('sql', 'plpgsql')
      AND p.proname NOT IN ('business_timezone', 'business_date', 'business_today')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid
                      AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e')
  LOOP
    original := pg_get_functiondef(item.oid);
    revised := regexp_replace(original, '\mCURRENT_DATE\M', 'public.business_today()', 'gi');
    -- These columns are timestamptz. Explicit document date casts stay unchanged.
    revised := regexp_replace(revised,
      '([a-zA-Z_][a-zA-Z_0-9]*\.(movement_date|created_at))::date',
      'public.business_date(\1)', 'gi');
    IF revised <> original THEN EXECUTE revised; END IF;
  END LOOP;

  -- Views must use the same commercial day. CREATE OR REPLACE preserves
  -- existing columns, ownership and grants. Explicitly carry security options.
  FOR item IN
    SELECT c.oid, n.nspname, c.relname, c.reloptions FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    original := pg_get_viewdef(item.oid, true);
    revised := regexp_replace(original, '\mCURRENT_DATE\M', 'public.business_today()', 'gi');
    IF revised <> original THEN
      EXECUTE format('CREATE OR REPLACE VIEW %I.%I %s AS %s', item.nspname, item.relname,
        CASE WHEN item.reloptions IS NULL THEN ''
             ELSE 'WITH (' || array_to_string(item.reloptions, ', ') || ')' END, revised);
    END IF;
  END LOOP;

  FOR item IN
    SELECT n.nspname, c.relname, a.attname FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND a.atttypid = 'date'::regtype
      AND pg_get_expr(d.adbin, d.adrelid) = 'CURRENT_DATE'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT public.business_today()',
      item.nspname, item.relname, item.attname);
  END LOOP;
END;
$migration$;

-- Do not infer a user's intention from a timestamp's hour and replace it.
CREATE OR REPLACE FUNCTION public.normalize_inventory_movement_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_at IS NULL THEN NEW.created_at := CURRENT_TIMESTAMP; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
