import { parseDateValue } from '@/utils/calendarDate';
import { formatForDisplay } from '@/utils/timezoneUtils';
import React, { useState } from 'react';
import { PaymentWithDetails, ManualApplication } from '@/types/payments';
import { usePayments } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Calculator, CheckCircle, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { computeIvaToSeparate } from '@/utils/ivaF29Utils';
import { toast } from 'sonner';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PaymentApplicationModal");
interface PaymentApplicationModalProps {
  payment: PaymentWithDetails;
  availableInvoices: any[];
  onClose: () => void;
}

export const PaymentApplicationModal: React.FC<PaymentApplicationModalProps> = ({
  payment,
  availableInvoices,
  onClose
}) => {
  const { applyPaymentManual } = usePayments();
  const [applications, setApplications] = useState<ManualApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmLargeApply, setConfirmLargeApply] = useState(false);
  const batchProgress = useBatchProgress();

  // Ordenar facturas por fecha de vencimiento (más antiguas primero)
  const sortedInvoices = [...availableInvoices].sort((a, b) => {
    const dateA = parseDateValue(a.due_date);
    const dateB = parseDateValue(b.due_date);
    return dateA.getTime() - dateB.getTime();
  });

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    if (checked) {
      const invoice = sortedInvoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        const invoiceRemaining = invoice.remaining_amount ?? (invoice.total - (invoice.paid_amount ?? 0));
        const paymentRemaining = payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0));
        const maxAmount = Math.min(invoiceRemaining, paymentRemaining - getTotalSelected());
        
        if (maxAmount <= 0) {
          toast.error('No hay monto disponible para aplicar a esta factura');
          return;
        }
        
        // Si el monto coincide exactamente con la factura, mostrar confirmación
        if (maxAmount === invoiceRemaining && invoiceRemaining > 100000) {
          toast.info(`Se aplicará el monto completo de ${formatCurrency(maxAmount)} a esta factura`);
        }
        
        setApplications([...applications, { invoice_id: invoiceId, amount: maxAmount }]);
      }
    } else {
      setApplications(applications.filter(app => app.invoice_id !== invoiceId));
    }
  };

  const handleAmountChange = (invoiceId: string, amount: number) => {
    const invoice = sortedInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    const invoiceRemaining = invoice.remaining_amount ?? (invoice.total - (invoice.paid_amount ?? 0));
    const paymentRemaining = payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0));
    const currentApplication = applications.find(app => app.invoice_id === invoiceId)?.amount || 0;
    
    const maxAmount = Math.min(invoiceRemaining, paymentRemaining - getTotalSelected() + currentApplication);
    const validAmount = Math.max(0, Math.min(amount || 0, maxAmount));
    
    setApplications(applications.map(app => 
      app.invoice_id === invoiceId ? { ...app, amount: validAmount } : app
    ));
  };

  const getTotalSelected = () => Math.max(0, applications.reduce((sum, app) => sum + (app.amount || 0), 0));

  // IVA a separar para el F29 = suma del vat de las facturas seleccionadas.
  // Política G5N: el pago cubre el total, así que la factura pagada aporta su IVA completo.
  const getSelectedInvoiceObjects = () =>
    applications
      .map(app => sortedInvoices.find(inv => inv.id === app.invoice_id))
      .filter((inv): inv is (typeof sortedInvoices)[number] => Boolean(inv));

  const _isValidApplication = () => {
    const total = getTotalSelected();
    const paymentRemaining = payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0));
    return total > 0 && total <= paymentRemaining && applications.length > 0;
  };

  const submitApplications = async () => {
    if (applications.length === 0) {
      toast.error('Debe seleccionar al menos una factura');
      return;
    }

    const total = getTotalSelected();
    const available = payment.remaining_amount || 0;
    
    if (total <= 0) {
      toast.error('El monto total a aplicar debe ser mayor a 0');
      return;
    }
    
    if (total > available) {
      toast.error(`Monto inválido. Disponible: ${formatCurrency(available)}, Seleccionado: ${formatCurrency(total)}`);
      return;
    }

    setLoading(true);
    batchProgress.start('Conciliando pago con facturas', applications.length);
    
    try {
      // Simular progreso por factura
      for (let i = 0; i < applications.length; i++) {
        const app = applications[i];
        const invoice = sortedInvoices.find(inv => inv.id === app.invoice_id);
        batchProgress.update(i + 1, invoice?.numero_fiscal || invoice?.folio || `Factura ${i + 1}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      await applyPaymentManual(payment.id, applications);
      batchProgress.complete();
      
      const { total: ivaTotal } = computeIvaToSeparate(getSelectedInvoiceObjects());

      setTimeout(() => {
        batchProgress.close();
        toast.success(`Pago aplicado exitosamente a ${applications.length} factura(s)`);
        if (ivaTotal > 0) {
          toast.info(`Separar ${formatCurrency(ivaTotal)} para pago de IVA (F29)`, { duration: 8000 });
        }
        onClose();
      }, 1500);
    } catch (error) {
      logger.error('Error applying payment:', error);
      batchProgress.error('Error al aplicar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const total = getTotalSelected();
    if (total > 500000) {
      setConfirmLargeApply(true);
      return;
    }
    await submitApplications();
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-4xl w-[95vw] overflow-clip border-border/70 bg-card p-0">
          <DialogHeader className="sticky top-0 z-10 border-b border-border/70 bg-muted/20 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle>Conciliar Pago con Facturas</DialogTitle>
                <p className="text-sm text-muted-foreground">
                Cliente: {payment.client?.name} | Monto disponible: {formatCurrency(payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0)))}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Calculator className="size-4 text-primary" />
                <span className="font-medium text-foreground">Resumen de Aplicación</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total seleccionado:</p>
                  <p className="font-semibold text-foreground">{formatCurrency(getTotalSelected())}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Restante del pago:</p>
                  <p className="font-semibold text-foreground">
                    {formatCurrency((payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0))) - getTotalSelected())}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Facturas seleccionadas:</p>
                  <p className="font-semibold text-foreground">{applications.length}</p>
                </div>
              </div>
              {getTotalSelected() > 0 && (
                <div className="mt-3 border-t border-primary/20 pt-3">
                  <p className="text-xs text-primary">
                    ✓ Las facturas seleccionadas se marcarán como pagadas automáticamente
                  </p>
                </div>
              )}
            </div>

            {applications.length > 0 && (() => {
              const { total: ivaTotal, items } = computeIvaToSeparate(getSelectedInvoiceObjects());
              if (ivaTotal <= 0) return null;
              return (
                <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="size-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">IVA a separar para F29</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(ivaTotal)}</p>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                      {items.filter(item => item.iva > 0).map(item => (
                        <li key={item.folio} className="flex justify-between gap-4">
                          <span className="truncate">{item.folio}</span>
                          <span className="whitespace-nowrap">{formatCurrency(item.iva)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Aplicar</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha Venc.</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Monto a Aplicar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInvoices.map(invoice => {
                  const application = applications.find(app => app.invoice_id === invoice.id);
                  const isSelected = !!application;
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleInvoiceToggle(invoice.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>{invoice.numero_fiscal || invoice.folio}</TableCell>
                      <TableCell>{formatForDisplay(invoice.due_date)}</TableCell>
                      <TableCell>{formatCurrency(invoice.total)}</TableCell>
                      <TableCell>{formatCurrency(invoice.remaining_amount)}</TableCell>
                      <TableCell>
                        {isSelected ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={application.amount}
                            onChange={(e) => handleAmountChange(invoice.id, parseFloat(e.target.value) || 0)}
                            max={Math.min(invoice.remaining_amount, payment.remaining_amount)}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
              <Button variant="outline" className="border-border/70 bg-background/60" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleApply} 
                disabled={loading || applications.length === 0}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle className="size-4 mr-2" />
                {loading ? 'Aplicando...' : 'Aplicar Pago'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmLargeApply} onOpenChange={setConfirmLargeApply}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aplicación masiva</AlertDialogTitle>
            <AlertDialogDescription>
              Se aplicarán {formatCurrency(getTotalSelected())} a {applications.length} factura(s). Esta acción puede ser difícil de revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={async () => {
                setConfirmLargeApply(false);
                await submitApplications();
              }}
            >
              Aplicar pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
    </>
  );
};
