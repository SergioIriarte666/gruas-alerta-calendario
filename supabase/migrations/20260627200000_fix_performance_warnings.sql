BEGIN;

-- =============================================================================
-- Performance Advisor fixes:
--   1. duplicate_index (2)       → eliminar índices redundantes
--   2. auth_rls_initplan (82)    → wrappear auth.uid() en subselects
--   3. multiple_permissive (52)  → consolidar políticas redundantes
-- =============================================================================


-- #############################################################################
-- 1. DUPLICATE INDEXES
-- #############################################################################

-- inventory_stock: unique_item_location e inventory_stock_item_id_location_id_key
-- son constraints UNIQUE duplicados sobre las mismas columnas
ALTER TABLE public.inventory_stock DROP CONSTRAINT IF EXISTS unique_item_location;

-- services: services_folio_unique y services_folio_key duplicados
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_folio_unique;


-- #############################################################################
-- 2. AUTH_RLS_INITPLAN
--    En RLS policies, auth.uid() se re-evalúa por cada fila.
--    Con (select auth.uid()) se evalúa una sola vez por query.
--    Aplica a los schemas public, storage y realtime.
-- #############################################################################

DO $$
DECLARE
    pol record;
    new_using text;
    new_check text;
    altered_count int := 0;
BEGIN
    FOR pol IN
        SELECT
            n.nspname                                              AS schema_name,
            c.relname                                              AS table_name,
            p.polname                                              AS policy_name,
            pg_get_expr(p.polqual,      p.polrelid)               AS using_expr,
            pg_get_expr(p.polwithcheck, p.polrelid)               AS with_check_expr
        FROM pg_policy p
        JOIN pg_class     c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('public', 'storage', 'realtime')
          AND (
               pg_get_expr(p.polqual,      p.polrelid) ~ 'auth\.uid\(\)'
            OR pg_get_expr(p.polwithcheck, p.polrelid) ~ 'auth\.uid\(\)'
          )
    LOOP
        new_using := pol.using_expr;
        new_check := pol.with_check_expr;

        -- Replace auth.uid() → (select auth.uid())
        IF pol.using_expr IS NOT NULL
           AND pol.using_expr ~ 'auth\.uid\(\)' THEN
            new_using := regexp_replace(
                pol.using_expr,
                'auth\.uid\(\)',
                '(select auth.uid())',
                'g'
            );
            -- Fix accidental double-wrapping
            new_using := regexp_replace(
                new_using,
                '\(select\s+\(select\s+auth\.uid\(\)\)\)',
                '(select auth.uid())',
                'g'
            );
        END IF;

        IF pol.with_check_expr IS NOT NULL
           AND pol.with_check_expr ~ 'auth\.uid\(\)' THEN
            new_check := regexp_replace(
                pol.with_check_expr,
                'auth\.uid\(\)',
                '(select auth.uid())',
                'g'
            );
            new_check := regexp_replace(
                new_check,
                '\(select\s+\(select\s+auth\.uid\(\)\)\)',
                '(select auth.uid())',
                'g'
            );
        END IF;

        IF new_using IS DISTINCT FROM pol.using_expr
           AND new_using IS NOT NULL THEN
            EXECUTE format(
                'ALTER POLICY %I ON %I.%I USING (%s)',
                pol.policy_name,
                pol.schema_name,
                pol.table_name,
                new_using
            );
            altered_count := altered_count + 1;
        END IF;

        IF new_check IS DISTINCT FROM pol.with_check_expr
           AND new_check IS NOT NULL THEN
            EXECUTE format(
                'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                pol.policy_name,
                pol.schema_name,
                pol.table_name,
                new_check
            );
            altered_count := altered_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'auth_rls_initplan: % declaraciones ALTER POLICY ejecutadas', altered_count;
END;
$$;


-- #############################################################################
-- 3. MULTIPLE_PERMISSIVE_POLICIES
--    Cuando una tabla tiene >1 política permisiva para el mismo (rol, acción),
--    Postgres evalúa todas. Las consolidamos en una sola con OR.
--    Solo afecta al rol authenticated (no roles de sistema).
-- #############################################################################

DO $$
DECLARE
    grp record;
    pol record;
    merged_using   text;
    merged_check   text;
    new_name       text;
    to_drop        text[];
    dropped        text;
    cnt            int := 0;
BEGIN
    -- CTE no disponible en FOR loops con record,
    -- usamos subquery anidada para expandir polroles
    FOR grp IN
        SELECT
            sub.schema_name,
            sub.table_name,
            (sub.role_oid)::regrole::text AS role_name,
            sub.role_oid,
            sub.cmd_name,
            count(*) AS n_policies
        FROM (
            SELECT
                n.nspname      AS schema_name,
                c.relname      AS table_name,
                unnest(p.polroles) AS role_oid,
                CASE p.polcmd
                    WHEN 'r' THEN 'SELECT'
                    WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE'
                    WHEN 'd' THEN 'DELETE'
                    WHEN '*' THEN 'ALL'
                END            AS cmd_name
            FROM pg_policy p
            JOIN pg_class     c ON c.oid = p.polrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND p.polpermissive = true
              AND p.polroles IS NOT NULL
        ) sub
        GROUP BY sub.schema_name, sub.table_name, sub.role_oid, sub.cmd_name
        HAVING count(*) > 1
    LOOP
        -- Solo consolidar para roles de aplicación reales
        IF grp.role_name NOT IN ('authenticated') THEN
            CONTINUE;
        END IF;

        merged_using := NULL;
        merged_check := NULL;
        to_drop      := ARRAY[]::text[];

        FOR pol IN
            SELECT
                p.polname,
                pg_get_expr(p.polqual,      p.polrelid) AS using_expr,
                pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
            FROM pg_policy p
            JOIN pg_class     c ON c.oid = p.polrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname  = grp.schema_name
              AND c.relname  = grp.table_name
              AND p.polcmd   = (
                  CASE grp.cmd_name
                      WHEN 'SELECT' THEN 'r'
                      WHEN 'INSERT' THEN 'a'
                      WHEN 'UPDATE' THEN 'w'
                      WHEN 'DELETE' THEN 'd'
                      WHEN 'ALL'    THEN '*'
                  END
              )::"char"
              AND grp.role_oid = ANY(p.polroles)
              AND p.polpermissive = true
            ORDER BY p.polname
        LOOP
            to_drop := array_append(to_drop, pol.polname);

            IF pol.using_expr IS NOT NULL THEN
                IF merged_using IS NULL THEN
                    merged_using := '(' || pol.using_expr || ')';
                ELSE
                    merged_using := merged_using || ' OR (' || pol.using_expr || ')';
                END IF;
            END IF;

            IF pol.with_check_expr IS NOT NULL THEN
                IF merged_check IS NULL THEN
                    merged_check := '(' || pol.with_check_expr || ')';
                ELSE
                    merged_check := merged_check || ' OR (' || pol.with_check_expr || ')';
                END IF;
            END IF;
        END LOOP;

        IF array_length(to_drop, 1) >= 2 AND merged_using IS NOT NULL THEN
            new_name := grp.table_name
                     || '_' || grp.role_name
                     || '_' || grp.cmd_name
                     || '_consolidated';

            -- Dropear políticas originales
            FOREACH dropped IN ARRAY to_drop LOOP
                EXECUTE format(
                    'DROP POLICY IF EXISTS %I ON %I.%I',
                    dropped, grp.schema_name, grp.table_name
                );
            END LOOP;

            -- Crear política unificada
            IF merged_check IS NOT NULL THEN
                EXECUTE format(
                    'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %I USING (%s) WITH CHECK (%s)',
                    new_name, grp.schema_name, grp.table_name,
                    grp.cmd_name, grp.role_name,
                    merged_using, merged_check
                );
            ELSE
                EXECUTE format(
                    'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %I USING (%s)',
                    new_name, grp.schema_name, grp.table_name,
                    grp.cmd_name, grp.role_name,
                    merged_using
                );
            END IF;

            cnt := cnt + 1;
            RAISE NOTICE '  Consolidada % policies en %.% para % %',
                array_length(to_drop, 1),
                grp.schema_name, grp.table_name,
                grp.role_name, grp.cmd_name;
        END IF;
    END LOOP;

    RAISE NOTICE 'multiple_permissive_policies: % grupos consolidados', cnt;
END;
$$;

COMMIT;
