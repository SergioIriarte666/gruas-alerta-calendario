BEGIN;

-- Endurece funciones expuestas, corrige search_path mutable y elimina
-- políticas de bajo valor que abren superficie pública innecesaria.

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION IF EXISTS pg_trgm SET SCHEMA extensions;
ALTER EXTENSION IF EXISTS unaccent SET SCHEMA extensions;

ALTER FUNCTION public.force_update_service_to_invoiced(uuid, text, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recovery_redact(jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_inspection_equipment_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_business_documents_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.extract_quick_entry_photo_path(text)
  SET search_path = public, pg_temp;

DO $$
DECLARE
  fn_record record;
BEGIN
  FOR fn_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      fn_record.schema_name,
      fn_record.function_name,
      fn_record.args
    );

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      fn_record.schema_name,
      fn_record.function_name,
      fn_record.args
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  fn_name text;
  fn_record record;
  allowlist text[] := ARRAY[
    'apply_payment_manual',
    'apply_payment_selective',
    'approve_pending_user',
    'assign_user_client',
    'can_access_client_sensitive_data',
    'can_manage_confidential_business_documents',
    'can_view_notification',
    'check_bidirectional_sync_status',
    'check_cost_duplicates',
    'check_for_duplicate_payment',
    'check_inventory_sync_status',
    'check_supplier_duplicates',
    'check_supplier_invoice_duplicates',
    'cleanup_duplicate_payments',
    'cleanup_payment_duplicates',
    'comprehensive_payment_diagnosis',
    'create_automatic_payment_for_invoice',
    'create_inventory_consumption_movement',
    'create_invoice_transaction',
    'create_manual_commission',
    'current_user_role',
    'delete_service_cascade',
    'detect_duplicate_crane_parts',
    'diagnose_mixed_payment_invoices',
    'diagnose_payment_application_conflicts',
    'emergency_close_service',
    'execute_recovery_operation',
    'find_matching_costs_for_invoice',
    'fix_invoice_payment_inconsistencies',
    'fix_payment_system_inconsistencies',
    'force_resync_crane_part',
    'force_update_service_to_invoiced',
    'full_payment_cleanup_and_sync',
    'get_all_users',
    'get_client_payment_history',
    'get_commissions_with_details',
    'get_crane_metrics',
    'get_current_user_role',
    'get_current_user_role_safe',
    'get_document_expiry_alerts',
    'get_invoice_payment_status',
    'get_invoices_due_soon',
    'get_operator_linked_profile',
    'get_overdue_invoices_for_alerts',
    'get_parts_traceability',
    'get_pending_users',
    'get_pending_users_count',
    'get_purchase_void_impact',
    'get_regenerar_inspeccion_elegibles',
    'get_user_client_id',
    'get_user_client_id_safe',
    'global_inventory_cleanup',
    'has_role',
    'is_admin_user',
    'is_admin_user_safe',
    'is_authenticated_user',
    'is_authenticated_user_safe',
    'is_client_user',
    'is_client_user_safe',
    'is_operator_assigned_to_service',
    'is_operator_user',
    'is_operator_user_safe',
    'log_audit_entry',
    'log_cost_snapshot_entry',
    'mark_costs_paid_batch',
    'merge_inventory_items',
    'migrate_existing_consumption_movements',
    'migrate_legacy_crane_parts_data',
    'migrate_unsynced_crane_parts_to_inventory',
    'preview_next_invoice_folio',
    'preview_recovery_operation',
    'reject_pending_user',
    'remove_duplicate_payment_applications',
    'resolve_payment_application_conflicts',
    'smart_apply_payment',
    'sync_paid_invoices_with_payments',
    'toggle_user_status',
    'update_commission_payment_date',
    'update_overdue_invoices',
    'update_overdue_supplier_payments',
    'update_user_role',
    'update_vip_services_batch',
    'validate_payment_system_integrity',
    'void_inventory_purchase'
  ];
BEGIN
  FOREACH fn_name IN ARRAY allowlist
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
    END LOOP;
  END LOOP;
END;
$$;

DO $$
DECLARE
  fn_name text;
  fn_record record;
  denylist text[] := ARRAY[
    'admin_create_user',
    'apply_payment_fifo',
    'apply_pending_payments_to_invoices',
    'assign_default_cost_center',
    'audit_operator_user_id_change',
    'auto_update_invoice_status',
    'auto_update_maintenance_status',
    'backfill_maintenance_costs',
    'backfill_supplier_payments_from_costs',
    'build_import_batch_summary',
    'calculate_crane_part_total_value',
    'capture_recovery_audit',
    'cascade_delete_cost',
    'cascade_delete_service_data',
    'check_and_update_overdue_invoices',
    'check_auth_health',
    'check_inventory_alerts',
    'check_operator_visibility',
    'check_security_compliance',
    'check_security_status',
    'check_service_invoice_consistency',
    'cleanup_duplicate_inventory_costs',
    'cleanup_duplicate_profiles',
    'cleanup_orphaned_supplier_costs',
    'close_service_status_only',
    'create_cost_for_crane_part',
    'create_cost_for_crane_part_conditional',
    'create_cost_for_maintenance',
    'create_cost_from_maintenance',
    'create_cost_with_payment_link',
    'create_notification',
    'create_payment_from_existing_income',
    'create_supplier_payment_from_cost',
    'debug_service_states',
    'delete_commissions_on_service_delete',
    'delete_cost_for_crane_part',
    'delete_user_admin',
    'diagnose_maintenance_cost_integration',
    'diagnose_service_update_issues',
    'enforce_commission_batch_consistency',
    'enforce_product_service_description',
    'ensure_commission_operator_id',
    'fill_exit_costs',
    'final_security_check',
    'find_duplicate_suppliers',
    'fix_all_invoice_statuses',
    'fix_all_invoiced_services_status',
    'fix_all_maintenance_cost_descriptions',
    'fix_amphos_payment_applications',
    'fix_applied_amount_duplications',
    'fix_duplicate_fact_4011_application',
    'fix_duplicate_paid_amounts',
    'fix_existing_invoice_inconsistencies',
    'fix_existing_overdue_invoices',
    'fix_existing_payment_inconsistencies',
    'fix_inventory_cost_issues',
    'fix_maintenance_status_inconsistencies',
    'fix_materiales_electricos_unit_cost',
    'fix_negative_remaining_amounts',
    'fix_specific_payment_issue',
    'fix_unlinked_maintenance_costs',
    'force_close_service_bypass_triggers',
    'force_frontend_cache_refresh',
    'generate_database_backup',
    'generate_excess_folio',
    'generate_quick_backup',
    'generate_service_folio',
    'generate_simple_invoice_folio',
    'get_client_id_for_user',
    'get_default_cost_category_id',
    'get_invoice_overdue_stats',
    'get_maintenance_with_cost',
    'get_notification_summary',
    'get_operator_id_by_user',
    'get_or_create_inventory_supplier',
    'get_supplier_payment_stats',
    'get_supplier_sync_stats',
    'get_supplier_traceability_stats',
    'get_table_structure',
    'get_user_role',
    'get_user_role_from_table',
    'get_weighted_average_cost',
    'handle_immediate_consumption_update',
    'handle_new_user',
    'handle_user_invitation_acceptance',
    'import_xml_batch',
    'import_xml_costs',
    'import_xml_supplier_documents',
    'insert_notification_if_not_exists',
    'is_authenticated_admin',
    'is_authenticated_operator',
    'list_operators_config',
    'log_audit_changes',
    'log_import_batch_record',
    'log_security_event',
    'log_service_update_error',
    'maintain_payment_consistency',
    'maintain_payment_consistency_enhanced',
    'mark_all_notifications_read',
    'mark_notification_read',
    'mark_supplier_payment_as_paid',
    'merge_suppliers',
    'migrate_unsync_crane_parts',
    'normalize_inventory_movement_timestamp',
    'on_supplier_payment_delete',
    'prevent_disposed_crane_changes',
    'prevent_disposed_crane_records',
    'prevent_duplicate_commissions',
    'prevent_duplicate_maintenance_costs',
    'prevent_duplicate_payments',
    'prevent_duplicate_service_commissions',
    'prevent_invoice_overpayment',
    'prevent_operator_test_user_link',
    'prevent_overpayment_on_application',
    'propagate_invoice_folio_to_closure_services',
    'purge_expired_recovery_audit',
    'recalculate_crane_parts_costs',
    'recalculate_payment_balances',
    'recovery_assert_admin',
    'recovery_current_organization_id',
    'repair_payment_application',
    'rollback_import_batch',
    'safe_update_service',
    'search_voidable_inventory_purchases',
    'simple_payment_cleanup',
    'smart_link_maintenance_costs',
    'sync_closure_invoice_status',
    'sync_cost_deletion_cascade',
    'sync_cost_supplier_payment_deletion',
    'sync_cost_update_to_payment',
    'sync_crane_part_to_inventory',
    'sync_existing_paid_invoices',
    'sync_existing_services_to_resources',
    'sync_existing_supplier_payments_to_costs',
    'sync_inventory_consumption_to_parts',
    'sync_inventory_cost_to_movement',
    'sync_inventory_exit_to_crane_parts',
    'sync_inventory_to_supplier_and_cost',
    'sync_maintenance_costs',
    'sync_parts_purchase_to_inventory',
    'sync_role_to_profile',
    'sync_service_commissions',
    'sync_specific_income_to_payment',
    'sync_supplier_invoice_delete',
    'sync_supplier_invoice_update',
    'sync_supplier_payment_update_to_cost',
    'test_invoice_creation',
    'track_cost_changes',
    'track_crane_part_changes',
    'track_inventory_movement_changes',
    'track_service_changes',
    'trg_service_resources_commission_sync',
    'trg_services_commission_sync',
    'trigger_global_data_refresh',
    'update_closure_status_on_invoice',
    'update_cost_for_crane_part',
    'update_inventory_stock',
    'update_invoice_amounts',
    'update_invoice_status_from_payments',
    'update_payment_amounts',
    'update_payment_remaining_amount',
    'update_service_comprehensive',
    'update_services_to_invoiced_batch',
    'update_user_role_secure',
    'validate_all_warnings_eliminated',
    'validate_email',
    'validate_payment_amounts',
    'validate_payment_application_amount',
    'validate_rls_policies',
    'validate_service_update_data',
    'verify_auth_system',
    'verify_security_compliance'
  ];
BEGIN
  FOREACH fn_name IN ARRAY denylist
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
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
        fn_record.schema_name,
        fn_record.function_name,
        fn_record.args
      );
    END LOOP;
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "allow_insert_anon" ON public.frontend_error_logs;
DROP POLICY IF EXISTS "allow_insert_authenticated" ON public.frontend_error_logs;

REVOKE ALL ON TABLE public.frontend_error_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.frontend_error_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.frontend_error_logs
  FROM authenticated;

GRANT SELECT ON TABLE public.frontend_error_logs TO authenticated;
GRANT ALL ON TABLE public.frontend_error_logs TO service_role;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for company-assets" ON storage.objects;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'config'
      AND column_name = 'anonymous_signups_enabled'
  ) THEN
    EXECUTE 'UPDATE auth.config SET anonymous_signups_enabled = false';
  END IF;
END;
$$;

COMMIT;
