import React, { useState, useEffect } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { PaymentWithDetails } from '@/types/payments';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { SmartPaymentForm } from './SmartPaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { SelectivePaymentModal } from './SelectivePaymentModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Zap, Edit, DollarSign, AlertTriangle, History, RefreshCw, Eye, Download } from 'lucide-react';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { toast } from 'sonner';
import { PaymentApplicationsDetailModal } from './PaymentApplicationsDetailModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';
import { usePDFGeneration } from '@/hooks/usePDFGeneration';
import { generatePaymentReceiptPDF } from '@/utils/pdf/paymentReceiptPdfGenerator';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PaymentReconciliation");
interface PaymentReconciliationProps {
  onClose?: () => void;
}

export const PaymentReconciliation: React.FC<PaymentReconciliationProps> = ({ onClose }) => {
  const { 
    payments, 
    loading: paymentsLoading, 
    paymentSystemAvailable,
    applyPaymentSelective,
    getUnpaidInvoicesForClient,
    checkPaymentSystemAvailability,
    cleanupDuplicatePayments,
    syncPaidInvoicesWithPayments,
    getReconciliationStats,
    fixPaymentInconsistencies,
    validateSystemIntegrity,
    performBackgroundMaintenance,
    fixSystemInconsistencies,
    removeDuplicateApplications,
    getComprehensiveDiagnosis,
    refetch,
  } = usePayments();
  const { isGenerating: isGeneratingReceipt, generateAndDownload } = usePDFGeneration();

  const handleDownloadReceipt = (payment: PaymentWithDetails) => {
    generateAndDownload(
      async () => ({
        blob: await generatePaymentReceiptPDF(payment.id),
        fileName: `comprobante-${String(payment.id).slice(0, 8)}.pdf`,
      }),
      `comprobante-${String(payment.id).slice(0, 8)}.pdf`,
    );
  };

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectivePaymentModalOpen, setSelectivePaymentModalOpen] = useState(false);
  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [systemDiagnosis, setSystemDiagnosis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<PaymentWithDetails | null>(null);
  const [showHistoricalBackfill, setShowHistoricalBackfill] = useState(false);
  const [historicalMonth, setHistoricalMonth] = useState('');
  const [showAllBackfillClients, setShowAllBackfillClients] = useState(false);
  const [selectedBackfillClientIds, setSelectedBackfillClientIds] = useState<string[]>([]);
  const [backfillSelectionDirty, setBackfillSelectionDirty] = useState(false);
  const [backfillIsRunning, setBackfillIsRunning] = useState(false);
  const [backfillPreview, setBackfillPreview] = useState<{
    month: string;
    clientCount: number;
    serviceCount: number;
    totalNet: number;
    clientTotals: Array<{ clientId: string; clientName: string; serviceCount: number; net: number }>;
  } | null>(null);
  const [backfillResults, setBackfillResults] = useState<{
    month: string;
    processedClients: number;
    createdClosures: number;
    createdInvoices: number;
    createdPayments: number;
    reconciledInvoices: number;
    skippedClients: number;
    errors: Array<{ clientId: string; clientName: string; reason: string }>;
  } | null>(null);

  const { clients } = useClients();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadReconciliationStats();
    loadSystemDiagnosis();
  }, []);

  useEffect(() => {
    if (!showHistoricalBackfill) return;
    if (!historicalMonth) return;
    if (backfillIsRunning) return;
    if (!backfillPreview) return;
    buildBackfillPreview();
  }, [showAllBackfillClients]);


  const handleManualApplication = async (payment: PaymentWithDetails) => {
    try {
      const invoices = await getUnpaidInvoicesForClient(payment.client_id);
      setAvailableInvoices(invoices);
      setSelectedPayment(payment);
      setShowApplicationModal(true);
    } catch (error) {
      logger.error('Error loading invoices:', error);
      toast.error('Error al cargar facturas pendientes');
    }
  };

  const handleSelectiveApplication = async (fiscalNumbers: string[], applyOnlyToSpecified: boolean = true) => {
    if (!selectedPayment) return;
    
    try {
      await applyPaymentSelective(selectedPayment.id, fiscalNumbers, applyOnlyToSpecified);
      setSelectivePaymentModalOpen(false);
      setSelectedPayment(null);
      await refetch();
    } catch (error) {
      logger.error('Error in selective application:', error);
    }
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

  const loadReconciliationStats = async () => {
    try {
      const stats = await getReconciliationStats();
      setReconciliationStats(stats);
    } catch (error) {
      logger.error('Error loading reconciliation stats:', error);
    }
  };

  const loadSystemDiagnosis = async () => {
    try {
      const diagnosis = await getComprehensiveDiagnosis();
      setSystemDiagnosis(diagnosis);
    } catch (error) {
      logger.error('Error loading system diagnosis:', error);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'applied': return 'default';
      case 'partial': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'applied': return 'Aplicado';
      case 'partial': return 'Parcial';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  const filteredPayments = selectedClient === 'all' 
    ? payments 
    : payments.filter(payment => payment.client_id === selectedClient);

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

      const baseClients = showAllBackfillClients
        ? clients
        : clients.filter(c => clientMap.has(c.id));

      const clientTotals = baseClients.map((c) => {
        const agg = clientMap.get(c.id) || { serviceCount: 0, net: 0 };
        return { clientId: c.id, clientName: toTitleCase(c.name), serviceCount: agg.serviceCount, net: Math.round(agg.net) };
      }).sort((a, b) => b.net - a.net);

      const totalNet = clientTotals.reduce((sum, c) => sum + c.net, 0);
      if (!backfillSelectionDirty) {
        setSelectedBackfillClientIds(clientTotals.filter(c => c.net > 0).map(c => c.clientId));
      }
      setBackfillPreview({
        month: historicalMonth,
        clientCount: clientTotals.length,
        serviceCount: services.length,
        totalNet,
        clientTotals,
      });
    } catch (e: any) {
      toast.error(e.message || 'Error generando previsualización');
    } finally {
      setBackfillIsRunning(false);
    }
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

    if (existing?.id) {
      return existing as any;
    }

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
    if (!transactionResult || !Array.isArray(transactionResult) || transactionResult.length === 0) {
      throw new Error('No se recibió respuesta válida al crear factura');
    }

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

    await supabase.from('service_closures').update({ status: 'invoiced', updated_at: new Date().toISOString() }).eq('id', closureId);

    if (invoice.folio && !invoice.folio.startsWith('HIST-')) {
      const newFolio = `HIST-F-${invoice.folio}`;
      const { error: folioError } = await supabase.from('invoices').update({ folio: newFolio }).eq('id', invoice.id);
      if (folioError) throw folioError;
      if (serviceIds.length > 0) {
        await supabase.from('services').update({ invoice_folio: newFolio }).in('id', serviceIds);
      }
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
    if (invoiceFresh.status === 'paid' || (invoiceFresh.remaining_amount || 0) <= 0) {
      return { paymentCreated: false, reconciled: true };
    }

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

      const result = {
        month: historicalMonth,
        processedClients: 0,
        createdClosures: 0,
        createdInvoices: 0,
        createdPayments: 0,
        reconciledInvoices: 0,
        skippedClients: 0,
        errors: [] as Array<{ clientId: string; clientName: string; reason: string }>,
      };

      for (const clientId of targetClientIds) {
        const clientServices = servicesByClient.get(clientId) || [];
        const clientName = toTitleCase(clients.find(c => c.id === clientId)?.name || clientId);
        try {
          const serviceIds = clientServices.map(s => s.id);
          const totalNet = calculateClosureTotal(clientServices as any);
          if (!serviceIds.length || totalNet <= 0) {
            result.skippedClients += 1;
            continue;
          }

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
      await refetch();
      await loadReconciliationStats();
      toast.success('Backfill histórico completado');
    } catch (e: any) {
      toast.error(e.message || 'Error ejecutando backfill');
    } finally {
      setBackfillIsRunning(false);
    }
  };

  if (!paymentSystemAvailable) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Sistema de pagos no disponible. Por favor, contacte al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Conciliación de Pagos</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              onClick={() => {
                setShowHistoricalBackfill(true);
                const now = new Date();
                const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                setHistoricalMonth(month);
                setShowAllBackfillClients(false);
                setSelectedBackfillClientIds([]);
                setBackfillSelectionDirty(false);
                setBackfillPreview(null);
                setBackfillResults(null);
              }}
              variant="outline"
              size="sm"
            >
              <Zap className="size-4 mr-2" />
              Backfill Mes
            </Button>
          )}
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={paymentsLoading}
          >
            <RefreshCw className={`size-4 mr-2 ${paymentsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            onClick={() => setShowPaymentForm(true)}
            size="sm"
          >
            <Plus className="size-4 mr-2" />
            Registrar Pago
          </Button>
          <Button
            onClick={() => setShowHistory(true)}
            variant="outline"
            size="sm"
          >
            <History className="size-4 mr-2" />
            Historial
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      {reconciliationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold">{reconciliationStats.pending_payments || 0}</p>
                </div>
                <DollarSign className="size-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aplicados</p>
                  <p className="text-2xl font-bold">{reconciliationStats.applied_payments || 0}</p>
                </div>
                <DollarSign className="size-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Parciales</p>
                  <p className="text-2xl font-bold">{reconciliationStats.partial_payments || 0}</p>
                </div>
                <DollarSign className="size-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Monto</p>
                  <p className="text-2xl font-bold">{formatCurrency(reconciliationStats.total_amount || 0)}</p>
                </div>
                <DollarSign className="size-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.filter(c => c.isActive).map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {toTitleCase(client.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="text-center py-8">Cargando pagos...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay pagos registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Aplicado</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.client?.name ? toTitleCase(payment.client.name) : 'Desconocido'}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.bank_reference}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(payment.status)}>
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(payment.applied_amount)}</TableCell>
                    <TableCell>{formatCurrency(payment.remaining_amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {payment.status === 'applied' && payment.applied_amount > 0 ? (
                          <span className="text-sm text-muted-foreground">Aplicado</span>
                        ) : payment.status === 'pending' || payment.remaining_amount > 0 ? (
                          <span className="text-sm text-muted-foreground">Pendiente</span>
                        ) : null}

                        {/* Botón Comprobante */}
                        <Button
                          onClick={() => handleDownloadReceipt(payment)}
                          disabled={isGeneratingReceipt}
                          size="sm"
                          variant="ghost"
                          className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950"
                        >
                          <Download className="size-4 mr-1" />
                          Comprobante
                        </Button>

                        {/* Botón Ver Detalle */}
                        {payment.applied_amount > 0 && (
                          <Button
                            onClick={() => {
                              setSelectedPaymentForDetail(payment);
                              setShowPaymentDetail(true);
                            }}
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                          >
                            <Eye className="size-4 mr-1" />
                            Ver Detalle
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      {showPaymentForm && (
        <SmartPaymentForm
          onClose={() => {
            setShowPaymentForm(false);
            refetch();
          }}
          onPaymentCreated={(paymentId, clientId) => {
            setShowPaymentForm(false);
            setSelectedClient(clientId);
            refetch();
            toast.success('Pago registrado. Ahora puede aplicarlo manualmente desde esta vista.', {
              duration: 5000,
            });
          }}
        />
      )}

      {showApplicationModal && selectedPayment && (
        <PaymentApplicationModal
          payment={selectedPayment}
          availableInvoices={availableInvoices}
          onClose={() => {
            setShowApplicationModal(false);
            refetch();
          }}
        />
      )}

      {showHistory && (
        <PaymentHistory
          onClose={() => setShowHistory(false)}
        />
      )}

      {selectivePaymentModalOpen && selectedPayment && (
        <SelectivePaymentModal
          payment={selectedPayment}
          isOpen={selectivePaymentModalOpen}
          onClose={() => {
            setSelectivePaymentModalOpen(false);
            setSelectedPayment(null);
          }}
          onApply={handleSelectiveApplication}
        />
      )}

      {/* Modal de Detalle de Aplicaciones de Pago */}
      {showPaymentDetail && selectedPaymentForDetail && (
        <PaymentApplicationsDetailModal
          payment={selectedPaymentForDetail}
          isOpen={showPaymentDetail}
          onClose={() => {
            setShowPaymentDetail(false);
            setSelectedPaymentForDetail(null);
          }}
        />
      )}

      <Dialog open={showHistoricalBackfill} onOpenChange={setShowHistoricalBackfill}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Backfill histórico (cierre → factura → conciliación)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Input
                  type="month"
                  value={historicalMonth}
                  onChange={(e) => setHistoricalMonth(e.target.value)}
                  disabled={backfillIsRunning}
                />
              </div>
              <div className="space-y-2">
                <Label>Regla</Label>
                <Input value="1 factura por cliente" disabled />
              </div>
            </div>

            {backfillPreview && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Previsualización</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={showAllBackfillClients}
                        onCheckedChange={(checked) => setShowAllBackfillClients(Boolean(checked))}
                        disabled={backfillIsRunning}
                      />
                      <span>Mostrar todos los clientes</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Seleccionados: {selectedBackfillClientIds.length}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Clientes: {backfillPreview.clientCount} · Servicios: {backfillPreview.serviceCount} · Neto: {formatCurrency(backfillPreview.totalNet)}
                  </div>
                  <div className="max-h-48 overflow-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[48px]">
                            <Checkbox
                              checked={
                                backfillPreview.clientTotals.length > 0 &&
                                backfillPreview.clientTotals.every(row => selectedBackfillClientIds.includes(row.clientId))
                              }
                              onCheckedChange={(checked) => {
                                setBackfillSelectionDirty(true);
                                if (checked === true) {
                                  setSelectedBackfillClientIds(backfillPreview.clientTotals.map(r => r.clientId));
                                } else {
                                  setSelectedBackfillClientIds([]);
                                }
                              }}
                              disabled={backfillIsRunning}
                            />
                          </TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Servicios</TableHead>
                          <TableHead className="text-right">Neto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backfillPreview.clientTotals.map(row => (
                          <TableRow key={row.clientId}>
                            <TableCell>
                              <Checkbox
                                checked={selectedBackfillClientIds.includes(row.clientId)}
                                onCheckedChange={(checked) => {
                                  setBackfillSelectionDirty(true);
                                  const isChecked = checked === true;
                                  setSelectedBackfillClientIds((prev) => {
                                    if (isChecked) return prev.includes(row.clientId) ? prev : [...prev, row.clientId];
                                    return prev.filter(id => id !== row.clientId);
                                  });
                                }}
                                disabled={backfillIsRunning}
                              />
                            </TableCell>
                            <TableCell>{row.clientName}</TableCell>
                            <TableCell className="text-right">{row.serviceCount}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.net)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {backfillResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resultado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    Procesados: {backfillResults.processedClients} · Conciliadas: {backfillResults.reconciledInvoices} · Omitidos: {backfillResults.skippedClients}
                  </div>
                  <div>
                    Cierres: {backfillResults.createdClosures} · Facturas: {backfillResults.createdInvoices} · Pagos: {backfillResults.createdPayments}
                  </div>
                  {backfillResults.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium text-destructive">Errores ({backfillResults.errors.length})</div>
                      <div className="max-h-40 overflow-auto border rounded p-2 space-y-1">
                        {backfillResults.errors.map((err, idx) => (
                          <div key={`${err.clientId}-${idx}`}>
                            {err.clientName}: {err.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={buildBackfillPreview}
              disabled={backfillIsRunning || !historicalMonth}
            >
              Previsualizar
            </Button>
            <Button
              type="button"
              onClick={runHistoricalBackfill}
              disabled={backfillIsRunning || !historicalMonth}
            >
              Ejecutar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
