BEGIN;

-- Restaurar acceso a authenticated para funciones que el frontend necesita
-- y fueron incorrectamente movidas a service_role en la migración anterior.

DO $$
DECLARE
    fn_name text;
    fn_record record;
    frontend_functions text[] := ARRAY[
        'get_regenerar_inspeccion_elegibles',
        'get_pending_users',
        'get_pending_users_count',
        'reject_pending_user',
        'toggle_user_status',
        'get_all_users',
        'update_user_role',
        'get_purchase_void_impact',
        'execute_recovery_operation',
        'preview_recovery_operation',
        'log_audit_entry',
        'mark_costs_paid_batch'
    ];
BEGIN
    FOREACH fn_name IN ARRAY frontend_functions
    LOOP
        FOR fn_record IN
            SELECT
                n.nspname AS schema_name,
                p.proname AS function_name,
                pg_get_function_identity_arguments(p.oid) AS args
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.prosecdef
              AND p.proname = fn_name
        LOOP
            EXECUTE format(
                'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
                fn_record.schema_name,
                fn_record.function_name,
                fn_record.args
            );
            RAISE NOTICE 'Restaurado acceso a authenticated para %', fn_record.function_name;
        END LOOP;
    END LOOP;
END;
$$;

COMMIT;
