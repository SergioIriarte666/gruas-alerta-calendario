BEGIN;

-- =============================================================================
-- Restaura acceso authenticated a las 31 funciones que el frontend llama
-- y fueron incorrectamente bloqueadas en 20260627210000.
-- =============================================================================

DO $$
DECLARE
    fn_name text;
    fn_record record;
    frontend_functions text[] := ARRAY[
        'check_bidirectional_sync_status',
        'check_inventory_sync_status',
        'cleanup_duplicate_payments',
        'cleanup_payment_duplicates',
        'comprehensive_payment_diagnosis',
        'create_inventory_consumption_movement',
        'delete_service_cascade',
        'detect_duplicate_crane_parts',
        'diagnose_mixed_payment_invoices',
        'diagnose_payment_application_conflicts',
        'emergency_close_service',
        'fix_invoice_payment_inconsistencies',
        'fix_payment_system_inconsistencies',
        'force_resync_crane_part',
        'force_update_service_to_invoiced',
        'full_payment_cleanup_and_sync',
        'global_inventory_cleanup',
        'log_cost_snapshot_entry',
        'merge_inventory_items',
        'migrate_existing_consumption_movements',
        'migrate_legacy_crane_parts_data',
        'migrate_unsynced_crane_parts_to_inventory',
        'remove_duplicate_payment_applications',
        'resolve_payment_application_conflicts',
        'sync_paid_invoices_with_payments',
        'update_commission_payment_date',
        'update_overdue_invoices',
        'update_overdue_supplier_payments',
        'update_vip_services_batch',
        'validate_payment_system_integrity',
        'void_inventory_purchase'
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
            RAISE NOTICE 'Restaurado: %.%', fn_record.schema_name, fn_record.function_name;
        END LOOP;
    END LOOP;
END;
$$;

COMMIT;
