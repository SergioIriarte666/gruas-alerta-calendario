import React, { useState, useEffect } from 'react';
import { useClients } from '@/hooks/useClients';
import { usePayments } from '@/hooks/usePayments';
import {
  usePendingClientInvoices,
  useDuplicatePaymentCheck,
} from '@/hooks/invoices/useSmartPaymentData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import DatePickerInput from '@/components/common/DatePickerInput';
import { getTodayLocal, formatForDisplay } from '@/utils/timezoneUtils';
import { extractFolioFromDescription } from '@/utils/folioExtractor';
import { businessClock } from '@/utils/businessClock';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { createLogger } from "@/lib/logger";

const logger = createLogger("SmartPaymentForm");

interface SmartPaymentFormProps {
  onClose: () => void;
  preselectedClientId?: string;
  onPaymentCreated?: (paymentId: string, clientId: string) => void;
}

export const SmartPaymentForm: React.FC<SmartPaymentFormProps> = ({
  onClose,
  preselectedClientId,
  onPaymentCreated
}) => {
  const { clients } = useClients();
  const { createPayment, getInvoicePaymentStatus, applyPaymentManual } = usePayments();

  const [formData, setFormData] = useState({
    client_id: preselectedClientId && preselectedClientId !== 'all' ? preselectedClientId : '',
    amount: '',
    payment_date: getTodayLocal(),
    bank_reference: '',
    payment_method: 'transferencia',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isAmountAutoCalculated, setIsAmountAutoCalculated] = useState(false);
  const [paymentStatusWarnings, setPaymentStatusWarnings] = useState<Record<string, string>>({});
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const batchProgress = useBatchProgress();

  // Detectar folio en notas o referencia bancaria
  const detectedFolioInNotes = React.useMemo(
    () => extractFolioFromDescription(formData.notes),
    [formData.notes],
  );
  const detectedFolioInBankRef = React.useMemo(
    () => extractFolioFromDescription(formData.bank_reference),
    [formData.bank_reference],
  );
  const detectedPaymentFolio = detectedFolioInNotes || detectedFolioInBankRef;

  const clientId = formData.client_id || null;
  const { data: clientInvoices = [] } = usePendingClientInvoices(clientId);
  const { data: duplicateWarning = '' } = useDuplicatePaymentCheck(
    formData.client_id,
    formData.amount,
    formData.payment_date,
  );

  // Auto-update amount when invoices are selected
  useEffect(() => {
    if (selectedInvoiceIds.length > 0) {
      const selectedTotal = getSelectedInvoicesTotal();
      setFormData(prev => ({ ...prev, amount: selectedTotal.toString() }));
      setIsAmountAutoCalculated(true);
    } else if (isAmountAutoCalculated) {
      setFormData(prev => ({ ...prev, amount: '' }));
      setIsAmountAutoCalculated(false);
    }
  }, [selectedInvoiceIds]);

  // Clear selection when amount is manually changed
  useEffect(() => {
    if (!isAmountAutoCalculated && formData.amount && selectedInvoiceIds.length > 0) {
      setSelectedInvoiceIds([]);
    }
  }, [formData.amount, isAmountAutoCalculated]);

  // Verificar estado de pago de facturas seleccionadas
  const checkInvoicePaymentStatus = async () => {
    if (selectedInvoiceIds.length === 0) {
      setPaymentStatusWarnings({});
      return;
    }
    const warnings: Record<string, string> = {};
    for (const invoiceId of selectedInvoiceIds) {
      try {
        const status = await getInvoicePaymentStatus(invoiceId);
        if (status && typeof status === 'object' && 'has_automatic_payments' in status && status.has_automatic_payments) {
          warnings[invoiceId] = 'Esta factura fue marcada como pagada automáticamente';
        }
      } catch (error) {
        logger.error('Error checking invoice payment status:', error);
      }
    }
    setPaymentStatusWarnings(warnings);
  };

  useEffect(() => {
    if (selectedInvoiceIds.length > 0) {
      checkInvoicePaymentStatus();
    } else {
      setPaymentStatusWarnings({});
    }
  }, [selectedInvoiceIds]);

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds(prev => [...prev, invoiceId]);
    } else {
      setSelectedInvoiceIds(prev => prev.filter(id => id !== invoiceId));
    }
  };

  const handleSelectAllInvoices = (checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds(clientInvoices.map(inv => inv.id));
    } else {
      setSelectedInvoiceIds([]);
    }
  };

  const getTotalPendingAmount = () => {
    return clientInvoices.reduce((sum, inv) => sum + (inv.remaining_amount || inv.total), 0);
  };

  const getSelectedInvoicesTotal = () => {
    return clientInvoices
      .filter(inv => selectedInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + (inv.remaining_amount || inv.total), 0);
  };

  const getPaymentRecommendation = () => {
    const paymentAmount = parseFloat(formData.amount) || 0;
    if (selectedInvoiceIds.length === 0) return null;
    if (paymentAmount === 0) return null;
    const selectedTotal = getSelectedInvoicesTotal();
    if (paymentAmount === selectedTotal) {
      return {
        type: 'perfect',
        message: `Monto exacto - ${selectedInvoiceIds.length === 1 ? 'La factura seleccionada será pagada' : `Las ${selectedInvoiceIds.length} facturas seleccionadas serán pagadas`} completamente`,
        icon: <CheckCircle className="size-4 text-success" />
      };
    } else {
      return {
        type: 'mismatch',
        message: `El monto debe ser exactamente ${formatCurrency(selectedTotal)} para ${selectedInvoiceIds.length === 1 ? 'la factura seleccionada' : `las ${selectedInvoiceIds.length} facturas seleccionadas`}`,
        icon: <AlertTriangle className="size-4 text-danger" />
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.amount) return;

    if (selectedInvoiceIds.length > 0) {
      const selectedTotal = getSelectedInvoicesTotal();
      const paymentAmount = parseFloat(formData.amount);
      if (selectedTotal !== paymentAmount) {
        toast.error(`El monto debe ser exactamente ${formatCurrency(selectedTotal)} para las facturas seleccionadas`);
        return;
      }
    }
    if (duplicateWarning) {
      setShowDuplicateConfirm(true);
      return;
    }
    await processSubmit();
  };

  const processSubmit = async () => {
    setLoading(true);
    if (selectedInvoiceIds.length > 0) {
      batchProgress.start('Registrando y aplicando pago', selectedInvoiceIds.length + 1);
    }
    try {
      if (selectedInvoiceIds.length > 0) {
        batchProgress.update(1, 'Creando pago...');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      const payment = await createPayment({
        client_id: formData.client_id,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date,
        bank_reference: formData.bank_reference || undefined,
        payment_method: formData.payment_method,
        notes: formData.notes || undefined,
        status: 'pending'
      });

      if (selectedInvoiceIds.length > 0) {
        const applications = selectedInvoiceIds.map(invoiceId => {
          const invoice = clientInvoices.find(inv => inv.id === invoiceId);
          return { invoice_id: invoiceId, amount: invoice?.remaining_amount || 0 };
        });
        for (let i = 0; i < selectedInvoiceIds.length; i++) {
          const invoice = clientInvoices.find(inv => inv.id === selectedInvoiceIds[i]);
          batchProgress.update(i + 2, invoice?.numero_fiscal || invoice?.folio || `Factura ${i + 1}`);
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        await applyPaymentManual(payment.id, applications);
        batchProgress.complete();
        setTimeout(() => {
          batchProgress.close();
          toast.success(`Pago registrado y aplicado a ${selectedInvoiceIds.length} factura(s)`);
          if (onPaymentCreated) onPaymentCreated(payment.id, formData.client_id);
          onClose();
        }, 1500);
      } else {
        toast.success('Pago registrado exitosamente');
        if (onPaymentCreated) onPaymentCreated(payment.id, formData.client_id);
        onClose();
      }
    } catch (error: any) {
      logger.error('Error creating payment:', error);
      if (selectedInvoiceIds.length > 0) batchProgress.error('Error al registrar el pago');
      if (error.message?.includes('duplicado')) {
        toast.error('Pago duplicado detectado. Revise los pagos existentes.');
      } else {
        toast.error(`Error al registrar el pago: ${error.message || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = clients.find(c => c.id === formData.client_id);
  const recommendation = getPaymentRecommendation();

  return <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl w-[95vw] border-border/70 bg-card p-0 flex flex-col">
        <DialogHeader className="shrink-0 z-10 border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              Registrar Pago Inteligente
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cliente */}
            <div>
              <Label htmlFor="client">Cliente *</Label>
              <Select value={formData.client_id || undefined} onValueChange={value => setFormData({ ...formData, client_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.isActive).map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">{toTitleCase(client.name)}</span>
                        {client.department && client.department !== 'General' && (
                          <span className="text-xs text-primary">{client.department}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Información del cliente y facturas */}
            {selectedClient && <Card className="border-border/70 bg-muted/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{toTitleCase(selectedClient.name)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {clientInvoices.length > 0 ? <>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Facturas pendientes:</span> {clientInvoices.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Total pendiente:</span> {formatCurrency(getTotalPendingAmount())}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Próximas facturas a pagar:</span>
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={clientInvoices.length > 0 && selectedInvoiceIds.length === clientInvoices.length} onChange={e => handleSelectAllInvoices(e.target.checked)} className="size-3 rounded border border-border checked:bg-primary checked:border-primary" />
                        Seleccionar todas
                      </label>
                    </div>
                    {(showAllInvoices ? clientInvoices : clientInvoices.slice(0, 3)).map(invoice => {
                      const isSelected = selectedInvoiceIds.includes(invoice.id);
                      return <div key={invoice.id} className={`flex items-center justify-between rounded-lg border p-2 text-sm ${isSelected ? 'border-primary/30 bg-primary/10' : 'border-border/70 bg-background/60'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isSelected} onChange={e => handleInvoiceToggle(invoice.id, e.target.checked)} className="size-4 rounded border border-border checked:bg-primary checked:border-primary" />
                          <span className="font-medium">{invoice.numero_fiscal || invoice.folio}</span>
                          <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                            {invoice.status}
                          </Badge>
                          {invoice.due_date && (() => {
                            const isOverdue = new Date(invoice.due_date + 'T12:00:00') < businessClock.now();
                            return (
                              <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                Vence: {formatForDisplay(invoice.due_date)}
                              </span>
                            );
                          })()}
                          {paymentStatusWarnings[invoice.id] && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                            ⚠️ Pago automático
                          </Badge>}
                        </div>
                        <span>{formatCurrency(invoice.remaining_amount || invoice.total)}</span>
                      </div>;
                    })}
                    {clientInvoices.length > 3 && <button type="button" onClick={() => setShowAllInvoices(!showAllInvoices)} className="w-full rounded py-1 text-center text-xs text-primary transition-colors hover:bg-primary/10 hover:text-primary">
                      {showAllInvoices ? 'Mostrar menos' : `+${clientInvoices.length - 3} facturas más`}
                    </button>}
                  </div>
                </> : <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Este cliente no tiene facturas pendientes de pago.
                  </AlertDescription>
                </Alert>}
              </CardContent>
            </Card>}

            {/* Monto */}
            <div>
              <Label htmlFor="amount">Monto del Pago *</Label>
              <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={e => {
                setFormData({ ...formData, amount: e.target.value });
                setIsAmountAutoCalculated(false);
              }} placeholder="0.00" required className={isAmountAutoCalculated ? "border-success/30 bg-success/10" : ""} />

              {recommendation && (
                <Alert className={`mt-2 ${recommendation.type === 'perfect' ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10'}`}>
                  <div className="flex items-center gap-2">
                    {recommendation.icon}
                    <AlertDescription>{recommendation.message}</AlertDescription>
                  </div>
                </Alert>
              )}

              {Object.keys(paymentStatusWarnings).length > 0 && <Alert className="mt-2">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  Algunas facturas seleccionadas ya tienen pagos automáticos aplicados.
                  Proceda solo si está seguro de aplicar pagos adicionales.
                </AlertDescription>
              </Alert>}

              {duplicateWarning && <Alert className="mt-2">
                <AlertTriangle className="size-4" />
                <AlertDescription>{duplicateWarning}</AlertDescription>
              </Alert>}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment_date">Fecha de Pago *</Label>
                <DatePickerInput
                  id="payment_date"
                  value={formData.payment_date}
                  onChange={(value) => setFormData({ ...formData, payment_date: value })}
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div>
                <Label htmlFor="payment_method">Método de Pago</Label>
                <Select value={formData.payment_method} onValueChange={value => setFormData({ ...formData, payment_method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="deposito">Depósito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="bank_reference">Referencia Bancaria</Label>
              <Input id="bank_reference" value={formData.bank_reference} onChange={e => setFormData({ ...formData, bank_reference: e.target.value })} placeholder="Número de referencia o comprobante" />
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Observaciones adicionales" rows={3} />
            </div>

            {detectedPaymentFolio && (
              <Alert className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40">
                <AlertTriangle className="size-4 text-amber-600" />
                <AlertDescription className="text-xs">
                  Folio <strong>{detectedPaymentFolio}</strong> detectado en{' '}
                  {detectedFolioInNotes ? 'las notas' : 'la referencia bancaria'}.
                  {' '}Para aplicar el pago, selecciona las facturas en la lista superior.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 border-t border-border/70 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Procesando...' : 'Registrar Pago'}
              </Button>
              <Button type="button" variant="outline" className="border-border/70 bg-background/60" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
      <AlertDialogContent className="border-border/70 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Posible pago duplicado</AlertDialogTitle>
          <AlertDialogDescription>
            {duplicateWarning || 'Se detectó un pago similar. Confirma si quieres continuar con el registro.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              setShowDuplicateConfirm(false);
              await processSubmit();
            }}
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
  </>;
};
