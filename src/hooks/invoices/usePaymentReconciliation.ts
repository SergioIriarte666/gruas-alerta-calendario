import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { useUser } from '@/contexts/UserContext';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';
import { businessClock } from '@/utils/businessClock';
import { toTitleCase } from '@/lib/utils';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import type { PaymentWithDetails } from '@/types/payments';

const logger = createLogger('usePaymentReconciliation');

export interface BackfillPreview {
  month: string;
  clientCount: number;
  serviceCount: number;
  totalNet: number;
  clientTotals: Array<{ clientId: string; clientName: string; serviceCount: number; net: number }>;
}

export interface BackfillResults {
  month: string;
  processedClients: number;
  createdClosures: number;
  createdInvoices: number;
  createdPayments: number;
  reconciledInvoices: number;
  skippedClients: number;
  errors: Array<{ clientId: string; clientName: string; reason: string }>;
}

export const usePaymentReconciliation = () => {
  const paymentsHook = usePayments();
  const { clients } = useClients();
  const { user } = useUser();

  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [systemDiagnosis, setSystemDiagnosis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showHistoricalBackfill, setShowHistoricalBackfill] = useState(false);
  const [historicalMonth, setHistoricalMonth] = useState('');
  const [showAllBackfillClients, setShowAllBackfillClients] = useState(false);
  const [selectedBackfillClientIds, setSelectedBackfillClientIds] = useState<string[]>([]);
  const [backfillSelectionDirty, setBackfillSelectionDirty] = useState(false);
  const [backfillIsRunning, setBackfillIsRunning] = useState(false);
  const [backfillPreview, setBackfillPreview] = useState<BackfillPreview | null>(null);
  const [backfillResults, setBackfillResults] = useState<BackfillResults | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadReconciliationStats = useCallback(async () => {
    try {
      const stats = await paymentsHook.getReconciliationStats();
      setReconciliationStats(stats);
    } catch (error) {
      logger.error('Error loading reconciliation stats:', error);
    }
  }, [paymentsHook.getReconciliationStats]);

  const loadSystemDiagnosis = useCallback(async () => {
    try {
      const diagnosis = await paymentsHook.getComprehensiveDiagnosis();
      setSystemDiagnosis(diagnosis);
    } catch (error) {
      logger.error('Error loading system diagnosis:', error);
    }
  }, [paymentsHook.getComprehensiveDiagnosis]);

  useEffect(() => {
    loadReconciliationStats();
    loadSystemDiagnosis();
  }, []);

  useEffect(() => {
    if (!showHistoricalBackfill || !historicalMonth || backfillIsRunning || !backfillPreview) return;
    buildBackfillPreview();
  }, [showAllBackfillClients]);

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    try {
      const invoices = await paymentsHook.getUnpaidInvoicesForClient(payment.client_id);
      return { invoices, payment };
    } catch (error) {
      logger.error('Error loading invoices:', error);
      toast.error('Error al cargar facturas pendientes');
      return null;
    }
  };

  const handleSelectiveApplication = async (
    payment: PaymentWithDetails,
    fiscalNumbers: string[],
    applyOnlyToSpecified = true,
  ) => {
    await paymentsHook.applyPaymentSelective(payment.id, fiscalNumbers, applyOnlyToSpecified);
    await paymentsHook.refetch();
  };

  const performAutomaticMaintenance = async () => {
    setIsProcessing(true);
    try {
      await loadReconciliationStats();
      await loadSystemDiagnosis();
    } finally {
      setIsProcessing(false);
    }
  };

  const toISODate = (date: Date) => date.toISOString().slice(0, 10);

  const getMonthRange = (month: string) => {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return { from: toISODate(start), to: toISODate(end) };
  };

  const getHistoricalTags = (month: string, clientId: string) => {
    const monthTag = `HIST-${month}`;
    return {
      monthTag,
      closurePurchaseOrder: monthTag,
      invoiceNotes: `${monthTag}|CLI=${clientId}`,
      paymentBankReference: `${monthTag}-CLI-${clientId}`,
      paymentNotes: `Pago histórico ${month} | 1 factura/cliente`,
      applicationNotes: `Conciliación histórica ${month}`,
    };
  };

  const fetchEligibleServicesForMonth = async (month: string) => {
    const { from, to } = getMonthRange(month);
    const { data: services, error } = await supabase
      .from('services')
      .select(
        'id, client_id, status, service_date, value, client_covered_amount, has_excess, custody_mode, custody_days, custody_daily_rate, custody_total_amount'
      )
      .gte('service_date', from)
      .lte('service_date', to)
      .in('status', ['completed'])
      .not('client_id', 'is', null);
    if (error) throw error;
    return services || [];
  };

  const generateNextClosureFolio = async () => {
    const { data: lastClosure } = await supabase
      .from('service_closures')
      .select('folio')
      .like('folio', 'CIE-%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1;
    if (lastClosure?.folio) {
      const match = (lastClosure.folio as string).match(/CIE-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    return `CIE-${String(nextNumber).padStart(3, '0')}`;
  };

  const ensureClosure = async (month: string, clientId: string, serviceIds: string[], totalNet: number) => {
    const { from, to } = getMonthRange(month);
    const { closurePurchaseOrder } = getHistoricalTags(month, clientId);

    const { data: existing } = await supabase
      .from('service_closures')
      .select('id, folio, total, status')
      .eq('client_id', clientId)
      .eq('date_from', from)
      .eq('date_to', to)
      .eq('purchase_order', closurePurchaseOrder)
      .maybeSingle();

    if (existing?.id) return existing as any;

    const folio = await generateNextClosureFolio();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { data: closure, error } = await supabase
      .from('service_closures')
      .insert({
        folio,
        date_from: from,
        date_to: to,
        client_id: clientId,
        total: Math.round(totalNet),
        status: 'closed',
        purchase_order: closurePurchaseOrder,
        created_by: authUser?.id || null,
      })
      .select('id, folio, total, status')
      .single();

    if (error) throw error;

    if (serviceIds.length > 0) {
      const closureServices = serviceIds.map(serviceId => ({ closure_id: closure.id, service_id: serviceId }));
      const BATCH_SIZE = 50;
      for (let i = 0; i < closureServices.length; i += BATCH_SIZE) {
        const batch = closureServices.slice(i, i + BATCH_SIZE);
        const { error: relError } = await supabase
          .from('closure_services')
          .upsert(batch as any, { onConflict: 'closure_id,service_id', ignoreDuplicates: true });
        if (relError) throw relError;
      }
    }

    return closure;
  };

  const ensureInvoice = async (month: string, clientId: string, closureId: string, serviceIds: string[], subtotalNet: number) => {
    const { to } = getMonthRange(month);
    const { invoiceNotes } = getHistoricalTags(month, clientId);

    const { data: existing } = await supabase
      .from('invoices')
      .select('id, folio, total, remaining_amount, status')
      .eq('client_id', clientId)
      .eq('notes', invoiceNotes)
      .maybeSingle();

    if (existing?.id) return existing as any;

    const issueDate = to;
    const dueDate = to;
    const vat = Math.round(subtotalNet * 0.19);
    const total = Math.round(subtotalNet + vat);

    const invoiceDataForTransaction = {
      client_id: clientId,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal: Math.round(subtotalNet),
      vat,
      total,
      numero_fiscal: null,
      status: 'sent',
      payment_term_id: '',
      notes: invoiceNotes,
    };

    const { data: transactionResult, error: transactionError } = await supabase
      .rpc('create_invoice_transaction', {
        p_invoice_data: invoiceDataForTransaction,
        p_service_ids: serviceIds,
      });

    if (transactionError) throw transactionError;
    if (!transactionResult || !Array.isArray(transactionResult) || transactionResult.length === 0)
      throw new Error('No se recibió respuesta válida al crear factura');

    const result = transactionResult[0] as any;
    if (!result?.invoice_id) throw new Error('Respuesta incompleta al crear factura');

    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, folio, total, remaining_amount, status')
      .eq('id', result.invoice_id)
      .single();

    if (fetchError || !invoice) throw new Error('No se pudo obtener la factura creada');

    const { error: relError } = await supabase
      .from('invoice_closures')
      .upsert({ invoice_id: invoice.id, closure_id: closureId } as any, { onConflict: 'invoice_id,closure_id', ignoreDuplicates: true });
    if (relError) throw relError;

    await supabase.from('service_closures').update({ status: 'invoiced', updated_at: businessClock.nowISO() }).eq('id', closureId);

    if (invoice.folio && !invoice.folio.startsWith('HIST-')) {
      const newFolio = `HIST-F-${invoice.folio}`;
      const { error: folioError } = await supabase.from('invoices').update({ folio: newFolio }).eq('id', invoice.id);
      if (folioError) throw folioError;
      if (serviceIds.length > 0)
        await supabase.from('services').update({ invoice_folio: newFolio }).in('id', serviceIds);
      return { ...invoice, folio: newFolio } as any;
    }

    return invoice as any;
  };

  const ensurePaymentAndReconcile = async (month: string, clientId: string, invoice: any) => {
    const { paymentBankReference, paymentNotes, applicationNotes } = getHistoricalTags(month, clientId);
    const { to } = getMonthRange(month);

    const { data: invoiceFresh } = await supabase
      .from('invoices')
      .select('id, status, total, remaining_amount')
      .eq('id', invoice.id)
      .maybeSingle();

    if (!invoiceFresh?.id) throw new Error('Factura no encontrada para conciliación');
    if (invoiceFresh.status === 'paid' || (invoiceFresh.remaining_amount || 0) <= 0)
      return { paymentCreated: false, reconciled: true };

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, amount, applied_amount, remaining_amount, status')
      .eq('client_id', clientId)
      .eq('bank_reference', paymentBankReference)
      .maybeSingle();

    let paymentId = existingPayment?.id as string | undefined;
    if (!paymentId) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          client_id: clientId,
          amount: invoiceFresh.remaining_amount || invoiceFresh.total,
          payment_date: to,
          payment_method: 'transferencia',
          bank_reference: paymentBankReference,
          notes: paymentNotes,
          status: 'pending',
          applied_amount: 0,
          remaining_amount: invoiceFresh.remaining_amount || invoiceFresh.total,
          created_by: authUser?.id || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      paymentId = payment.id;
    }

    const applications = [
      { invoice_id: invoiceFresh.id, amount: invoiceFresh.remaining_amount || invoiceFresh.total, notes: applicationNotes },
    ];

    const { error: applyError } = await supabase.rpc('apply_payment_manual', {
      p_payment_id: paymentId,
      p_applications: applications,
    });
    if (applyError) throw applyError;

    const { data: after } = await supabase
      .from('invoices')
      .select('status, remaining_amount')
      .eq('id', invoiceFresh.id)
      .maybeSingle();

    const reconciled = after?.status === 'paid' || (after?.remaining_amount || 0) <= 0;
    return { paymentCreated: !existingPayment?.id, reconciled };
  };

  const buildBackfillPreview = async () => {
    if (!historicalMonth) return;
    setBackfillIsRunning(true);
    setBackfillPreview(null);
    setBackfillResults(null);
    try {
      const services = await fetchEligibleServicesForMonth(historicalMonth);
      const clientMap = new Map<string, { serviceCount: number; net: number }>();
      for (const s of services) {
        const clientId = s.client_id as string;
        const prev = clientMap.get(clientId) || { serviceCount: 0, net: 0 };
        const net = calculateClosureTotal([s as any]);
        clientMap.set(clientId, { serviceCount: prev.serviceCount + 1, net: prev.net + net });
      }

      const baseClients = showAllBackfillClients ? clients : clients.filter(c => clientMap.has(c.id));
      const clientTotals = baseClients
        .map((c) => {
          const agg = clientMap.get(c.id) || { serviceCount: 0, net: 0 };
          return { clientId: c.id, clientName: toTitleCase(c.name), serviceCount: agg.serviceCount, net: Math.round(agg.net) };
        })
        .sort((a, b) => b.net - a.net);

      const totalNet = clientTotals.reduce((sum, c) => sum + c.net, 0);
      if (!backfillSelectionDirty)
        setSelectedBackfillClientIds(clientTotals.filter(c => c.net > 0).map(c => c.clientId));

      setBackfillPreview({ month: historicalMonth, clientCount: clientTotals.length, serviceCount: services.length, totalNet, clientTotals });
    } catch (e: any) {
      toast.error(e.message || 'Error generando previsualización');
    } finally {
      setBackfillIsRunning(false);
    }
  };

  const runHistoricalBackfill = async () => {
    if (!historicalMonth) return;
    setBackfillIsRunning(true);
    setBackfillResults(null);
    try {
      const services = await fetchEligibleServicesForMonth(historicalMonth);
      const servicesByClient = new Map<string, any[]>();
      for (const s of services) {
        const clientId = s.client_id as string;
        const list = servicesByClient.get(clientId) || [];
        list.push(s);
        servicesByClient.set(clientId, list);
      }

      const targetClientIds = selectedBackfillClientIds.length
        ? selectedBackfillClientIds
        : Array.from(servicesByClient.keys());

      const result: BackfillResults = {
        month: historicalMonth,
        processedClients: 0,
        createdClosures: 0,
        createdInvoices: 0,
        createdPayments: 0,
        reconciledInvoices: 0,
        skippedClients: 0,
        errors: [],
      };

      for (const clientId of targetClientIds) {
        const clientServices = servicesByClient.get(clientId) || [];
        const clientName = toTitleCase(clients.find(c => c.id === clientId)?.name || clientId);
        try {
          const serviceIds = clientServices.map(s => s.id);
          const totalNet = calculateClosureTotal(clientServices as any);
          if (!serviceIds.length || totalNet <= 0) { result.skippedClients += 1; continue; }

          const { invoiceNotes } = getHistoricalTags(historicalMonth, clientId);
          const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id, status, remaining_amount, total')
            .eq('client_id', clientId)
            .eq('notes', invoiceNotes)
            .maybeSingle();

          if (existingInvoice?.id && (existingInvoice.status === 'paid' || (existingInvoice.remaining_amount || 0) <= 0)) {
            result.skippedClients += 1;
            continue;
          }

          const closure = await ensureClosure(historicalMonth, clientId, serviceIds, totalNet);
          result.createdClosures += closure?.id ? 1 : 0;

          const invoice = existingInvoice?.id
            ? { ...existingInvoice, id: existingInvoice.id }
            : await ensureInvoice(historicalMonth, clientId, closure.id, serviceIds, Math.round(totalNet));

          if (!existingInvoice?.id) result.createdInvoices += 1;

          const reconcile = await ensurePaymentAndReconcile(historicalMonth, clientId, invoice);
          if (reconcile.paymentCreated) result.createdPayments += 1;
          if (reconcile.reconciled) result.reconciledInvoices += 1;

          result.processedClients += 1;
        } catch (e: any) {
          result.errors.push({ clientId, clientName, reason: e?.message || 'Error desconocido' });
        }
      }

      setBackfillResults(result);
      await paymentsHook.refetch();
      await loadReconciliationStats();
      toast.success('Backfill histórico completado');
    } catch (e: any) {
      toast.error(e.message || 'Error ejecutando backfill');
    } finally {
      setBackfillIsRunning(false);
    }
  };

  const openBackfillDialog = () => {
    setShowHistoricalBackfill(true);
    const now = businessClock.now();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setHistoricalMonth(month);
    setShowAllBackfillClients(false);
    setSelectedBackfillClientIds([]);
    setBackfillSelectionDirty(false);
    setBackfillPreview(null);
    setBackfillResults(null);
  };

  return {
    // From usePayments
    payments: paymentsHook.payments,
    paymentsLoading: paymentsHook.loading,
    paymentSystemAvailable: paymentsHook.paymentSystemAvailable,
    applyPaymentSelective: paymentsHook.applyPaymentSelective,
    getUnpaidInvoicesForClient: paymentsHook.getUnpaidInvoicesForClient,
    refetch: paymentsHook.refetch,

    // Clients + user
    clients,
    isAdmin,

    // Stats
    reconciliationStats,
    systemDiagnosis,
    isProcessing,
    loadReconciliationStats,
    loadSystemDiagnosis,
    performAutomaticMaintenance,

    // Handlers
    handleManualApplication,
    handleSelectiveApplication,

    // Backfill state
    showHistoricalBackfill,
    setShowHistoricalBackfill,
    historicalMonth,
    setHistoricalMonth,
    showAllBackfillClients,
    setShowAllBackfillClients,
    selectedBackfillClientIds,
    setSelectedBackfillClientIds,
    backfillSelectionDirty,
    setBackfillSelectionDirty,
    backfillIsRunning,
    backfillPreview,
    backfillResults,

    // Backfill actions
    openBackfillDialog,
    buildBackfillPreview,
    runHistoricalBackfill,
  };
};
