-- Fix all functions missing SET search_path = public to prevent schema hijacking attacks
-- This addresses the critical security vulnerability where 87 functions are vulnerable

-- Get all function names and apply the fix
DO $$ 
DECLARE
    func RECORD;
BEGIN
    FOR func IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND NOT EXISTS (
              SELECT 1 FROM pg_proc p2
              WHERE p2.oid = p.oid
              AND p2.proconfig IS NOT NULL
              AND array_to_string(p2.proconfig, ',') LIKE '%search_path%'
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', 
                         func.function_name, 
                         func.args);
            RAISE NOTICE 'Fixed function: %.%(%)', 'public', func.function_name, func.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not fix function %.%(%): %', 
                        'public', func.function_name, func.args, SQLERRM;
        END;
    END LOOP;
END $$;

-- Verify the fix
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
          SELECT 1 FROM pg_proc p2
          WHERE p2.oid = p.oid
          AND p2.proconfig IS NOT NULL
          AND array_to_string(p2.proconfig, ',') LIKE '%search_path%'
      );
    
    RAISE NOTICE '=== VERIFICATION ===';
    RAISE NOTICE 'Remaining functions without search_path: %', remaining_count;
    
    IF remaining_count = 0 THEN
        RAISE NOTICE '✅ All functions now have SET search_path = public';
    ELSE
        RAISE WARNING '⚠️  % functions still need manual review', remaining_count;
    END IF;
END $$;