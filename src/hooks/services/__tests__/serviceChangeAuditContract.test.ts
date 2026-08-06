import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migrationPath =
  'supabase/migrations/20260805213000_expand_service_change_history.sql';

describe('contrato del historial de cambios de servicios', () => {
  it('audita los datos editables del vehículo y de la operación', () => {
    const migration = readWorkspaceFile(migrationPath);
    const auditLoop = migration.slice(
      migration.indexOf('FOREACH v_field_name IN ARRAY ARRAY['),
      migration.indexOf('] LOOP', migration.indexOf('FOREACH v_field_name IN ARRAY ARRAY[')),
    );

    expect(auditLoop).toContain("'vehicle_brand'");
    expect(auditLoop).toContain("'vehicle_model'");
    expect(auditLoop).toContain("'license_plate'");
    expect(auditLoop).toContain("'request_date'");
    expect(auditLoop).toContain("'service_date'");
    expect(auditLoop).toContain("'start_time'");
    expect(auditLoop).toContain("'end_time'");
    expect(auditLoop).toContain("'crane_mileage'");
    expect(auditLoop).toContain("'contact_person'");
    expect(auditLoop).toContain("'contact_phone'");
    expect(auditLoop).toContain("'outsourced_notes'");
    expect(auditLoop).toContain("'client_notifications_enabled'");
  });

  it('registra el estado inicial completo de cada servicio nuevo', () => {
    const migration = readWorkspaceFile(migrationPath);

    expect(migration).toContain('v_snapshot := jsonb_strip_nulls(jsonb_build_object(');
    expect(migration).toContain("'vehicle_brand', NEW.vehicle_brand");
    expect(migration).toContain("'vehicle_model', NEW.vehicle_model");
    expect(migration).toContain("'license_plate', NEW.license_plate");
    expect(migration).toContain("v_snapshot::text, 'Servicio creado'");
  });

  it('audita operadores, roles y comisiones desde service_resources', () => {
    const migration = readWorkspaceFile(migrationPath);
    const resourceFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.track_service_resource_changes'),
      migration.indexOf('DROP TRIGGER IF EXISTS trigger_track_service_resource_changes'),
    );

    expect(resourceFunction).toContain("'service_resource'");
    expect(resourceFunction).toContain("'resource_commission'");
    expect(resourceFunction).toContain("'resource_role'");
    expect(resourceFunction).toContain("'resource_primary'");
    expect(resourceFunction).toContain('NEW.commission_amount');
    expect(resourceFunction).toContain('NEW.operator_id');
    expect(resourceFunction).toContain('NEW.crane_id');
    expect(migration).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.service_resources');
  });

  it('mantiene el historial protegido contra escrituras directas', () => {
    const migration = readWorkspaceFile(migrationPath);

    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("SET search_path TO 'public', 'pg_temp'");
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.track_service_changes() FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.track_service_resource_changes() FROM PUBLIC, anon, authenticated;',
    );
  });

  it('muestra los nuevos eventos y refresca el historial inmediatamente', () => {
    const historyComponent = readWorkspaceFile(
      'src/components/services/ServiceChangeHistory.tsx',
    );
    const serviceManager = readWorkspaceFile(
      'src/hooks/services/useServiceManager.ts',
    );
    const notificationsToggle = readWorkspaceFile(
      'src/components/services/ClientNotificationsToggle.tsx',
    );

    expect(historyComponent).toContain("vehicle_brand: 'Marca Vehículo'");
    expect(historyComponent).toContain("vehicle_model: 'Modelo Vehículo'");
    expect(historyComponent).toContain("license_plate: 'Patente'");
    expect(historyComponent).toContain("resource_commission: 'Comisión del Operador'");
    expect(historyComponent).toContain('hasInitialSnapshot');
    expect(serviceManager).toContain(
      "queryClient.invalidateQueries({ queryKey: ['service-change-history', id] })",
    );
    expect(notificationsToggle).toContain(
      "queryClient.invalidateQueries({ queryKey: ['service-change-history', serviceId] })",
    );
  });
});
