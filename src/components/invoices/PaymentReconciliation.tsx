import React, { useState } from 'react';
import { usePaymentReconciliation } from '@/hooks/invoices/usePaymentReconciliation';
import { usePDFGeneration } from '@/hooks/usePDFGeneration';
import { generatePaymentReceiptPDF } from '@/utils/pdf/paymentReceiptPdfGenerator';
import { PaymentApplicationModal } from './PaymentApplicationModal';
import { SmartPaymentForm } from './SmartPaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { SelectivePaymentModal } from './SelectivePaymentModal';
import { PaymentApplicationsDetailModal } from './PaymentApplicationsDetailModal';
import { ClientPaymentImportDialog } from '@/components/facturas/ClientPaymentImportDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, History, RefreshCw, Eye, Download, DollarSign, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { safeDateToDisplaySlashes } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import type { PaymentWithDetails } from '@/types/payments';

interface PaymentReconciliationProps {
  onClose?: () => void;
}

const getStatusBadgeVariant = (status: string) => {
  if (status === 'applied') return 'default' as const;
  if (status === 'partial') return 'secondary' as const;
  return 'outline' as const;
};

const getStatusLabel = (status: string) => {
  if (status === 'applied') return 'Aplicado';
  if (status === 'partial') return 'Parcial';
  if (status === 'pending') return 'Pendiente';
  return status;
};

export const PaymentReconciliation: React.FC<PaymentReconciliationProps> = ({ onClose }) => {
  const hook = usePaymentReconciliation();
  const { isGenerating: isGeneratingReceipt, generateAndDownload } = usePDFGeneration();
  const { user } = useUser();

  const [selectedClient, setSelectedClient] = useState('all');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectivePaymentModalOpen, setSelectivePaymentModalOpen] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<PaymentWithDetails | null>(null);
  const [showClientPaymentImport, setShowClientPaymentImport] = useState(false);

  const filteredPayments = selectedClient === 'all'
    ? hook.payments
    : hook.payments.filter(p => p.client_id === selectedClient);

  const handleDownloadReceipt = (payment: PaymentWithDetails) => {
    generateAndDownload(
      async () => ({ blob: await generatePaymentReceiptPDF(payment.id), fileName: `comprobante-${String(payment.id).slice(0, 8)}.pdf` }),
      `comprobante-${String(payment.id).slice(0, 8)}.pdf`,
    );
  };

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    const result = await hook.handleManualApplication(payment);
    if (result) {
      setAvailableInvoices(result.invoices);
      setSelectedPayment(result.payment);
      setShowApplicationModal(true);
    }
  };

  const handleSelectiveApplication = async (fiscalNumbers: string[], applyOnlyToSpecified = true) => {
    if (!selectedPayment) return;
    try {
      await hook.handleSelectiveApplication(selectedPayment, fiscalNumbers, applyOnlyToSpecified);
      setSelectivePaymentModalOpen(false);
      setSelectedPayment(null);
    } catch {
      // error toasted by hook
    }
  };

  if (!hook.paymentSystemAvailable) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="size-4" />
        <AlertDescription>Sistema de pagos no disponible. Por favor, contacte al administrador.</AlertDescription>
      </Alert>
    );
  }

  const s = hook.reconciliationStats;
  const stats = s ? [
    { label: 'Pendientes', value: s.pending_payments || 0, color: 'text-blue-500' },
    { label: 'Aplicados', value: s.applied_payments || 0, color: 'text-green-500' },
    { label: 'Parciales', value: s.partial_payments || 0, color: 'text-amber-500' },
    { label: 'Total Monto', value: formatCurrency(s.total_amount || 0), color: 'text-purple-500' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Conciliación de Pagos</h2>
        <div className="flex gap-2">
          <Button onClick={() => hook.refetch()} variant="outline" size="sm" disabled={hook.paymentsLoading}>
            <RefreshCw className={`size-4 mr-2 ${hook.paymentsLoading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
          {user?.role === 'admin' && (
            <Button onClick={() => setShowClientPaymentImport(true)} variant="outline" size="sm">
              <FileSpreadsheet className="size-4 mr-2" />Importar pago cliente
            </Button>
          )}
          <Button onClick={() => setShowPaymentForm(true)} size="sm"><Plus className="size-4 mr-2" />Registrar Pago</Button>
          <Button onClick={() => setShowHistory(true)} variant="outline" size="sm"><History className="size-4 mr-2" />Historial</Button>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <DollarSign className={`size-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-4 items-center">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full sm:w-[300px]"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {hook.clients.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{toTitleCase(c.name)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Pagos Registrados</CardTitle></CardHeader>
        <CardContent>
          {hook.paymentsLoading ? <div className="text-center py-8">Cargando pagos...</div>
            : filteredPayments.length === 0 ? <div className="text-center py-8 text-muted-foreground">No hay pagos registrados</div>
            : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead><TableHead>Monto</TableHead><TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead><TableHead>Aplicado</TableHead><TableHead>Pendiente</TableHead><TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="font-medium">{payment.client?.name ? toTitleCase(payment.client.name) : 'Desconocido'}</div>
                        <div className="text-sm text-muted-foreground">{payment.bank_reference}</div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{safeDateToDisplaySlashes(payment.payment_date)}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(payment.status)}>{getStatusLabel(payment.status)}</Badge></TableCell>
                      <TableCell>{formatCurrency(payment.applied_amount)}</TableCell>
                      <TableCell>{formatCurrency(payment.remaining_amount)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button onClick={() => handleDownloadReceipt(payment)} disabled={isGeneratingReceipt} size="sm" variant="ghost"
                            className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950">
                            <Download className="size-4 mr-1" />Comprobante
                          </Button>
                          {payment.applied_amount > 0 && (
                            <Button onClick={() => { setSelectedPaymentForDetail(payment); setShowPaymentDetail(true); }}
                              size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950">
                              <Eye className="size-4 mr-1" />Ver Detalle
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

      {showPaymentForm && (
        <SmartPaymentForm
          onClose={() => { setShowPaymentForm(false); hook.refetch(); }}
          onPaymentCreated={(paymentId, clientId) => { setShowPaymentForm(false); setSelectedClient(clientId); hook.refetch();
            toast.success('Pago registrado. Ahora puede aplicarlo manualmente desde esta vista.', { duration: 5000 }); }}
        />
      )}
      {showApplicationModal && selectedPayment && (
        <PaymentApplicationModal payment={selectedPayment} availableInvoices={availableInvoices}
          onClose={() => { setShowApplicationModal(false); hook.refetch(); }} />
      )}
      {showHistory && <PaymentHistory onClose={() => setShowHistory(false)} />}
      {selectivePaymentModalOpen && selectedPayment && (
        <SelectivePaymentModal payment={selectedPayment} isOpen={selectivePaymentModalOpen}
          onClose={() => { setSelectivePaymentModalOpen(false); setSelectedPayment(null); }} onApply={handleSelectiveApplication} />
      )}
      {showPaymentDetail && selectedPaymentForDetail && (
        <PaymentApplicationsDetailModal payment={selectedPaymentForDetail} isOpen={showPaymentDetail}
          onClose={() => { setShowPaymentDetail(false); setSelectedPaymentForDetail(null); }} />
      )}

      <ClientPaymentImportDialog
        open={showClientPaymentImport}
        onClose={() => setShowClientPaymentImport(false)}
      />
    </div>
  );
};
