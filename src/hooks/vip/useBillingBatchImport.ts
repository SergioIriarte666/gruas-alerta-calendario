import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useClosureOperations } from '@/hooks/closures/useClosureOperations';
import { useInvoiceOperations } from '@/hooks/invoices/useInvoiceOperations';
import { applyVipServiceBatchUpdates } from '@/utils/vipBatchServiceUpdater';
import {
  BillingBatchPlan,
  BillingImportRow,
  BillingInvoiceAssignment,
  formatQuoteNumber,
  formatPurchaseOrder,
  parseBillingWorkbook,
  reconcileBillingBatch,
} from '@/utils/billingBatchImport';
import { EXCESS_ROW_SUFFIX } from '@/utils/closureBilling';

export type BillingBatchBusyStage = 'parsing' | 'ocs' | 'closures' | 'invoices' | null;

export interface BillingBatchProgress {
  current: number;
  total: number;
  label: string;
}

export interface BillingBatchExecution {
  closureId?: string;
  closureFolio?: string;
  invoiceId?: string;
  invoiceFolio?: string;
}

export function useBillingBatchImport({
  clientId,
  services,
  onRefresh,
}: {
  clientId: string;
  services: Service[];
  onRefresh: () => Promise<unknown> | unknown;
}) {
  const queryClient = useQueryClient();
  const { createClosure } = useClosureOperations();
  const { createInvoice } = useInvoiceOperations();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<BillingImportRow[]>([]);
  const [allowPurchaseOrderOverwrite, setAllowPurchaseOrderOverwrite] = useState(false);
  const [busyStage, setBusyStage] = useState<BillingBatchBusyStage>(null);
  const [progress, setProgress] = useState<BillingBatchProgress | null>(null);
  const [error, setError] = useState('');
  const [ocsApplied, setOcsApplied] = useState(false);
  const [closuresComplete, setClosuresComplete] = useState(false);
  const [invoicesComplete, setInvoicesComplete] = useState(false);
  const [executions, setExecutions] = useState<Record<string, BillingBatchExecution>>({});
  const [planSnapshot, setPlanSnapshot] = useState<BillingBatchPlan | null>(null);

  const computedPlan = useMemo(() => reconcileBillingBatch({
    rows,
    services,
    clientId,
    allowPurchaseOrderOverwrite,
  }), [allowPurchaseOrderOverwrite, clientId, rows, services]);
  const plan = planSnapshot ?? computedPlan;

  const assertServicesCanBeClosed = useCallback(async (assignments: BillingInvoiceAssignment[]) => {
    const uniqueServices = new Map(
      assignments.flatMap((assignment) => assignment.services.map((service) => [service.id, service] as const)),
    );
    const serviceIds = [...uniqueServices.keys()];
    if (serviceIds.length === 0) return;

    const [linksResult, disputesResult] = await Promise.all([
      supabase
        .from('closure_services')
        .select('service_id, value_type, service_closures(folio)')
        .in('service_id', serviceIds),
      supabase
        .from('service_disputes')
        .select('service_id, services(folio)')
        .eq('status', 'open')
        .in('service_id', serviceIds),
    ]);
    if (linksResult.error) throw linksResult.error;
    if (disputesResult.error) throw disputesResult.error;

    const expectedTypeByServiceId = new Map(
      [...uniqueServices.values()].map((service) => [
        service.id,
        service.hasExcess && service.thirdPartyClientId === clientId ? 'excess' : 'covered',
      ] as const),
    );
    const conflict = linksResult.data?.find(
      (link) => expectedTypeByServiceId.get(link.service_id) === link.value_type,
    );
    if (conflict) {
      const closure = Array.isArray(conflict.service_closures)
        ? conflict.service_closures[0]
        : conflict.service_closures;
      throw new Error(
        `Un servicio del lote ya está incluido en el cierre ${closure?.folio || conflict.service_id}.`,
      );
    }

    if (disputesResult.data && disputesResult.data.length > 0) {
      const folios = disputesResult.data.map((dispute) => {
        const service = Array.isArray(dispute.services) ? dispute.services[0] : dispute.services;
        return service?.folio || dispute.service_id;
      });
      throw new Error(`Hay servicios con disputas abiertas: ${folios.join(', ')}.`);
    }
  }, [clientId]);

  const assertInvoiceNumbersAvailable = useCallback(async (assignments: BillingInvoiceAssignment[]) => {
    const fiscalNumbers = assignments.map((assignment) => assignment.row.invoiceNumber);
    if (fiscalNumbers.length === 0) return;
    const { data: duplicateRows, error: duplicateError } = await supabase
      .from('invoices')
      .select('numero_fiscal')
      .in('numero_fiscal', fiscalNumbers);
    if (duplicateError) throw duplicateError;
    if (duplicateRows && duplicateRows.length > 0) {
      const duplicates = duplicateRows.map((item) => item.numero_fiscal).filter(Boolean).join(', ');
      throw new Error(`Ya existen facturas con número fiscal: ${duplicates}.`);
    }
  }, []);

  const resetExecution = useCallback(() => {
    setOcsApplied(false);
    setClosuresComplete(false);
    setInvoicesComplete(false);
    setExecutions({});
    setPlanSnapshot(null);
    setProgress(null);
    setError('');
  }, []);

  const processFile = useCallback(async (file: File) => {
    setBusyStage('parsing');
    setError('');
    try {
      const parsedRows = await parseBillingWorkbook(file);
      setFileName(file.name);
      setRows(parsedRows);
      resetExecution();
      toast.success(`${parsedRows.length} facturas leídas`, {
        description: 'Revisa la conciliación antes de aplicar cambios.',
      });
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : 'No se pudo leer el archivo.';
      setError(message);
      toast.error('Archivo no válido', { description: message });
    } finally {
      setBusyStage(null);
    }
  }, [resetExecution]);

  const applyPurchaseOrders = useCallback(async () => {
    if (!plan.ready || rows.length === 0) {
      toast.error('El lote tiene diferencias que deben resolverse antes de aplicar OCs.');
      return false;
    }

    const updateByServiceId = new Map<string, { id: string; purchase_order: string; target_status: string; label: string }>();
    for (const assignment of plan.assignments) {
      for (const service of assignment.services) {
        updateByServiceId.set(service.id, {
          id: service.id,
          purchase_order: formatPurchaseOrder(assignment.row.purchaseOrder),
          target_status: 'with_purchase_order',
          label: service.folio,
        });
      }
    }
    const updates = [...updateByServiceId.values()];

    setBusyStage('ocs');
    setError('');
    setProgress({ current: 0, total: updates.length, label: 'Preparando actualización' });
    try {
      setProgress({ current: 0, total: updates.length, label: 'Validando cierres y facturas existentes' });
      await Promise.all([
        assertServicesCanBeClosed(plan.assignments),
        assertInvoiceNumbersAvailable(plan.assignments),
      ]);
      const result = await applyVipServiceBatchUpdates({
        updates,
        getLabel: (update) => updateByServiceId.get(update.id)?.label || update.id,
        onProgress: ({ processedCount, totalCount, currentLabel }) => {
          setProgress({ current: processedCount, total: totalCount, label: currentLabel });
        },
      });
      if (result.failedIds.length > 0) {
        throw new Error(`${result.failedIds.length} servicio(s) no pudieron actualizarse.`);
      }
      // Mantener la distribución conciliada durante las etapas siguientes,
      // aunque el refresco cambie el estado de los servicios.
      setPlanSnapshot(plan);
      setOcsApplied(true);
      await onRefresh();
      toast.success(`${result.successCount} servicios actualizados con OC`, {
        description: 'El lote quedó listo para crear cierres.',
      });
      return true;
    } catch (stageError) {
      const message = stageError instanceof Error ? stageError.message : 'No se pudieron aplicar las OCs.';
      setError(message);
      toast.error('Error en actualización de OCs', { description: message });
      return false;
    } finally {
      setBusyStage(null);
      setProgress(null);
    }
  }, [assertInvoiceNumbersAvailable, assertServicesCanBeClosed, onRefresh, plan, rows.length]);

  const closureServiceId = useCallback((service: Service): string => {
    const isThirdPartyExcess = service.hasExcess && service.thirdPartyClientId === clientId;
    return isThirdPartyExcess ? `${service.id}${EXCESS_ROW_SUFFIX}` : service.id;
  }, [clientId]);

  const createClosures = useCallback(async () => {
    if (!ocsApplied) {
      toast.error('Primero debes aplicar las órdenes de compra.');
      return false;
    }

    setBusyStage('closures');
    setError('');
    const nextExecutions = { ...executions };
    setProgress({ current: 0, total: plan.assignments.length, label: 'Preparando cierres' });
    try {
      const pendingAssignments = plan.assignments.filter(
        (assignment) => !nextExecutions[assignment.row.id]?.closureId,
      );
      await assertServicesCanBeClosed(pendingAssignments);

      for (let index = 0; index < plan.assignments.length; index += 1) {
        const assignment = plan.assignments[index];
        if (nextExecutions[assignment.row.id]?.closureId) {
          setProgress({ current: index + 1, total: plan.assignments.length, label: `Factura ${assignment.row.invoiceNumber}` });
          continue;
        }

        const serviceDates = assignment.services
          .map((service) => service.serviceDate)
          .filter(Boolean)
          .sort();
        const from = serviceDates[0] || assignment.row.issueDate;
        const to = serviceDates[serviceDates.length - 1] || from;
        const closure = await createClosure({
          serviceIds: assignment.services.map(closureServiceId),
          dateRange: { from, to },
          clientId,
          total: assignment.row.net,
          status: 'closed',
          purchaseOrder: formatPurchaseOrder(assignment.row.purchaseOrder),
        }, { silent: true });

        if (Math.round(closure.total) !== assignment.row.net) {
          await supabase.from('service_closures').delete().eq('id', closure.id);
          throw new Error(`El cierre ${closure.folio} no cuadra con la factura ${assignment.row.invoiceNumber}.`);
        }

        nextExecutions[assignment.row.id] = {
          ...nextExecutions[assignment.row.id],
          closureId: closure.id,
          closureFolio: closure.folio,
        };
        setExecutions({ ...nextExecutions });
        setProgress({ current: index + 1, total: plan.assignments.length, label: closure.folio });
      }

      setClosuresComplete(true);
      await onRefresh();
      toast.success(`${plan.assignments.length} cierres disponibles`, {
        description: 'El lote quedó listo para facturar.',
      });
      return true;
    } catch (stageError) {
      const message = stageError instanceof Error ? stageError.message : 'No se pudieron crear los cierres.';
      setError(message);
      toast.error('Creación de cierres incompleta', {
        description: `${message} Puedes reintentar; los cierres ya creados se conservarán.`,
      });
      return false;
    } finally {
      setBusyStage(null);
      setProgress(null);
    }
  }, [assertServicesCanBeClosed, clientId, closureServiceId, createClosure, executions, ocsApplied, onRefresh, plan.assignments]);

  const createInvoices = useCallback(async (description: string) => {
    if (!closuresComplete) {
      toast.error('Primero deben quedar creados todos los cierres.');
      return false;
    }
    if (description.trim().length < 10) {
      toast.error('La descripción de la factura debe tener al menos 10 caracteres.');
      return false;
    }

    setBusyStage('invoices');
    setError('');
    const nextExecutions = { ...executions };
    const pendingAssignments = plan.assignments.filter(
      (assignment) => !nextExecutions[assignment.row.id]?.invoiceId,
    );
    setProgress({ current: 0, total: pendingAssignments.length, label: 'Validando folios fiscales' });
    try {
      if (pendingAssignments.length > 0) {
        await assertInvoiceNumbersAvailable(pendingAssignments);
      }

      for (let index = 0; index < pendingAssignments.length; index += 1) {
        const assignment = pendingAssignments[index];
        const execution = nextExecutions[assignment.row.id];
        if (!execution?.closureId) {
          throw new Error(`La factura ${assignment.row.invoiceNumber} no tiene cierre asociado.`);
        }

        const invoice = await createInvoice({
          closureId: execution.closureId,
          clientId,
          issueDate: assignment.row.issueDate,
          dueDate: assignment.row.dueDate,
          subtotal: assignment.row.net,
          vat: assignment.row.vat,
          total: assignment.row.total,
          status: 'sent',
          numeroFiscal: assignment.row.invoiceNumber,
          notes: `Carga masiva · Cotización ${formatQuoteNumber(assignment.row.quoteNumber)} · ${formatPurchaseOrder(assignment.row.purchaseOrder)}`,
          productServiceDescription: description.trim(),
        }, { silent: true, skipInvalidation: true });

        nextExecutions[assignment.row.id] = {
          ...execution,
          invoiceId: invoice.id,
          invoiceFolio: invoice.folio,
        };
        setExecutions({ ...nextExecutions });
        setProgress({
          current: index + 1,
          total: pendingAssignments.length,
          label: `Factura fiscal ${assignment.row.invoiceNumber}`,
        });
      }

      setInvoicesComplete(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] }),
        queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['serviceDetails'] }),
      ]);
      await onRefresh();
      window.dispatchEvent(new CustomEvent('global-data-refresh'));
      toast.success(`${plan.assignments.length} facturas procesadas`, {
        description: 'Finalizó la carga masiva OC → cierre → factura.',
      });
      return true;
    } catch (stageError) {
      const message = stageError instanceof Error ? stageError.message : 'No se pudieron crear las facturas.';
      setError(message);
      toast.error('Facturación incompleta', {
        description: `${message} Puedes reintentar; las facturas ya creadas se conservarán.`,
      });
      return false;
    } finally {
      setBusyStage(null);
      setProgress(null);
    }
  }, [assertInvoiceNumbersAvailable, clientId, closuresComplete, createInvoice, executions, onRefresh, plan.assignments, queryClient]);

  const reset = useCallback(() => {
    if (busyStage) return;
    setFileName('');
    setRows([]);
    setAllowPurchaseOrderOverwrite(false);
    resetExecution();
  }, [busyStage, resetExecution]);

  return {
    fileName,
    rows,
    plan,
    allowPurchaseOrderOverwrite,
    setAllowPurchaseOrderOverwrite,
    busyStage,
    progress,
    error,
    ocsApplied,
    closuresComplete,
    invoicesComplete,
    executions,
    processFile,
    applyPurchaseOrders,
    createClosures,
    createInvoices,
    reset,
  };
}
