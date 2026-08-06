import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migrationPath =
  'supabase/migrations/20260805120000_commissions_service_source_and_payment_batches.sql';

describe('contrato del sistema de comisiones', () => {
  it('proyecta la comisión del servicio sin filtrar por estado', () => {
    const migration = readWorkspaceFile(migrationPath);
    const syncFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.sync_service_commissions'),
      migration.indexOf('COMMENT ON FUNCTION public.sync_service_commissions'),
    );

    expect(syncFunction).toContain("sr.resource_type = 'operator'");
    expect(syncFunction).toContain('sr.commission_amount > 0');
    expect(syncFunction).toContain('NOT o.commission_exempt');
    expect(syncFunction).not.toContain('v_service.status');
    expect(syncFunction).not.toMatch(/status\s+NOT\s+IN/i);
    expect(syncFunction).toContain('payment_date');
    expect(syncFunction).toContain('payment_batch_id');
    expect(syncFunction).toContain(
      'ON CONFLICT (service_id, operator_id, category_id)',
    );
    expect(syncFunction).toContain('AND NOT EXISTS (');
  });

  it('reconcilia las comisiones cuando cambia la elegibilidad del operador', () => {
    const migration = readWorkspaceFile(migrationPath);

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.trg_operator_commission_eligibility_sync()',
    );
    expect(migration).toContain(
      'AFTER UPDATE OF commission_exempt ON public.operators',
    );
    expect(migration).toContain(
      'PERFORM public.sync_service_commissions(v_service_id);',
    );
  });

  it('crea y paga el lote en una única función transaccional', () => {
    const migration = readWorkspaceFile(migrationPath);
    const batchFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.create_commission_payment_batch'),
      migration.indexOf('COMMENT ON FUNCTION public.create_commission_payment_batch'),
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.commission_batches');
    expect(batchFunction).toContain('INSERT INTO public.commission_batches');
    expect(batchFunction).toContain('UPDATE public.costs');
    expect(batchFunction).toContain('payment_date = p_payment_date');
    expect(batchFunction).toContain('payment_batch_id = v_batch_number');
    expect(batchFunction).toContain("subcategory = 'comisiones_pagadas'");
    expect(batchFunction).toContain('IF NOT public.is_admin_user_safe()');
    expect(batchFunction).toContain("set_config('app.commission_batch_payment', 'true', true)");
  });

  it('bloquea pagos y cambios de monto hechos directamente desde Costos', () => {
    const migration = readWorkspaceFile(migrationPath);
    const guardFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.guard_commission_cost_mutation'),
      migration.indexOf('DROP TRIGGER IF EXISTS guard_commission_cost_mutation_trigger'),
    );

    expect(guardFunction).toContain(
      'Las comisiones se pagan exclusivamente mediante un lote en el módulo Comisiones',
    );
    expect(guardFunction).toContain(
      "current_setting('app.commission_batch_payment', true)",
    );
    expect(guardFunction).toContain(
      "current_setting('app.commission_autoflow', true)",
    );
    expect(guardFunction).toContain(
      'La comisión debe modificarse desde el servicio',
    );
  });

  it('mantiene compatibilidad transaccional durante el despliegue y preserva lotes al editar', () => {
    const migration = readWorkspaceFile(migrationPath);
    const editFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.update_commission_payment_date'),
      migration.indexOf(
        'REVOKE ALL ON FUNCTION public.update_commission_payment_date',
      ),
    );

    expect(editFunction).toContain("p_payment_batch_id NOT LIKE 'LOTE-%'");
    expect(editFunction).toContain('INSERT INTO public.commission_batches');
    expect(editFunction).toContain("'operation', 'payment_date_edit'");
    expect(editFunction).toContain(
      'La edición de fecha no puede reemplazar el lote de pago original',
    );
    expect(editFunction).toContain(
      "set_config('app.commission_payment_date_edit', 'true', true)",
    );
  });

  it('usa la RPC de lote desde la UI y conserva el lote al editar la fecha', () => {
    const paymentBatchHook = readWorkspaceFile(
      'src/hooks/commissions/usePaymentBatches.ts',
    );
    const editDialog = readWorkspaceFile(
      'src/components/commissions/EditPaymentDateDialog.tsx',
    );
    const paymentDateHook = readWorkspaceFile(
      'src/hooks/commissions/useCommissionPayments.ts',
    );

    expect(paymentBatchHook).toContain(
      "supabase.rpc('create_commission_payment_batch'",
    );
    expect(paymentBatchHook).not.toContain(
      "supabase.rpc('update_commission_payment_date'",
    );
    expect(editDialog).not.toContain('EDIT-${Date.now()}');
    expect(paymentDateHook).not.toContain('paymentBatchId');
  });

  it('no oculta fallas al sincronizar operadores y montos del servicio', () => {
    const serviceManager = readWorkspaceFile(
      'src/hooks/services/useServiceManager.ts',
    );

    expect(serviceManager).toContain(
      'throw new Error(`No se pudo actualizar la comisión del operador:',
    );
    expect(serviceManager).toContain(
      'throw new Error(`No se pudo crear la asignación del operador:',
    );
    expect(serviceManager).toContain(
      'throw new Error(`No se pudo quitar la asignación anterior del operador:',
    );
  });

  it('filtra fechas localmente sin recargar las comisiones', () => {
    const commissionsPage = readWorkspaceFile('src/pages/Commissions.tsx');
    const commissionsHook = readWorkspaceFile(
      'src/hooks/commissions/useCommissions.ts',
    );
    const useCommissionsBlock = commissionsHook.slice(
      commissionsHook.indexOf('export const useCommissions ='),
      commissionsHook.indexOf('export const useCommissionsByOperator ='),
    );

    expect(commissionsPage).toContain('useCommissions();');
    expect(commissionsPage).not.toContain('useCommissions(filters)');
    expect(useCommissionsBlock).toContain("queryKey: ['commissions']");
    expect(useCommissionsBlock).toContain('queryFn: () => fetchCommissions()');
    expect(useCommissionsBlock).not.toContain('dateFrom');
    expect(useCommissionsBlock).not.toContain('dateTo');
  });
});
