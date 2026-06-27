BEGIN;

-- =============================================================================
-- Security Advisor - remaining warnings after 20260627170000
--   1. auth_allow_anonymous_sign_ins (112) → revocar acceso de anon a tablas
--   2. authenticated_security_definer (87)  → reducir allowlist a user-facing
--   3. auth_leaked_password_protection (1) → no es SQL, se habilita en Dashboard
-- =============================================================================


-- #############################################################################
-- 1. REVOCAR ACCESO DE "anon" A TODAS LAS TABLAS PÚBLICAS
--    El rol anon (no autenticado) no debería tener acceso a ninguna tabla.
--    Todas las operaciones se hacen como authenticated o service_role.
-- #############################################################################

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'REVOKE ALL ON TABLE %I.%I FROM anon',
            'public', r.tablename
        );
    END LOOP;

    FOR r IN
        SELECT sequence_name AS seqname
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format(
            'REVOKE ALL ON SEQUENCE %I.%I FROM anon',
            'public', r.seqname
        );
    END LOOP;

    RAISE NOTICE 'Permisos de anon revocados en schema public';
END;
$$;

-- Storage también: revocar a anon de buckets que no sean públicos
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'storage'
    LOOP
        EXECUTE format(
            'REVOKE ALL ON TABLE storage.%I FROM anon',
            r.tablename
        );
    END LOOP;
END;
$$;


-- #############################################################################
-- 2. REDUCIR ALLOWLIST: mover funciones administrativas a service_role
--    Solo dejamos expuestas a authenticated las funciones que el frontend
--    llama directamente via supabase.rpc().
-- #############################################################################

DO $$
DECLARE
    fn_name text;
    fn_record record;
    admin_only text[] := ARRAY[
        'cleanup_duplicate_payments',
        'cleanup_payment_duplicates',
        'comprehensive_payment_diagnosis',
        'diagnose_mixed_payment_invoices',
        'diagnose_payment_application_conflicts',
        'fix_invoice_payment_inconsistencies',
        'fix_payment_system_inconsistencies',
        'full_payment_cleanup_and_sync',
        'global_inventory_cleanup',
        'migrate_existing_consumption_movements',
        'migrate_legacy_crane_parts_data',
        'migrate_unsynced_crane_parts_to_inventory',
        'remove_duplicate_payment_applications',
        'resolve_payment_application_conflicts',
        'sync_paid_invoices_with_payments',
        'validate_payment_system_integrity',
        'check_bidirectional_sync_status',
        'check_inventory_sync_status',
        'get_all_users',
        'get_pending_users',
        'get_pending_users_count',
        'get_purchase_void_impact',
        'get_regenerar_inspeccion_elegibles',
        'merge_inventory_items',
        'preview_recovery_operation',
        'execute_recovery_operation',
        'reject_pending_user',
        'toggle_user_status',
        'update_commission_payment_date',
        'update_overdue_invoices',
        'update_overdue_supplier_payments',
        'update_user_role',
        'update_vip_services_batch',
        'force_resync_crane_part',
        'force_update_service_to_invoiced',
        'delete_service_cascade',
        'emergency_close_service',
        'void_inventory_purchase',
        'create_inventory_consumption_movement',
        'detect_duplicate_crane_parts',
        'log_audit_entry',
        'log_cost_snapshot_entry',
        'mark_costs_paid_batch'
    ];
BEGIN
    FOREACH fn_name IN ARRAY admin_only
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
                'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated',
                fn_record.schema_name,
                fn_record.function_name,
                fn_record.args
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Funciones administrativas revocadas de authenticated';
END;
$$;


COMMIT;
