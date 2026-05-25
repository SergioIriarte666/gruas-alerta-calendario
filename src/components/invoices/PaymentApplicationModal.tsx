import React, { useState } from 'react';
import { PaymentWithDetails, ManualApplication } from '@/types/payments';
import { usePayments } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Calculator, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';

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
  const batchProgress = useBatchProgress();

  // Ordenar facturas por fecha de vencimiento (más antiguas primero)
  const sortedInvoices = [...availableInvoices].sort((a, b) => {
    const dateA = new Date(a.due_date);
    const dateB = new Date(b.due_date);
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

  const isValidApplication = () => {
    const total = getTotalSelected();
    const paymentRemaining = payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0));
    return total > 0 && total <= paymentRemaining && applications.length > 0;
  };

  const handleApply = async () => {
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

    // Confirmación para montos grandes
    if (total > 500000) {
      const confirmed = window.confirm(
        `¿Está seguro de aplicar ${formatCurrency(total)} a ${applications.length} factura(s)?\n\n` +
        `Esta acción no se puede deshacer fácilmente.`
      );
      if (!confirmed) return;
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
      
      setTimeout(() => {
        batchProgress.close();
        toast.success(`Pago aplicado exitosamente a ${applications.length} factura(s)`);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error applying payment:', error);
      batchProgress.error('Error al aplicar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Conciliar Pago con Facturas</CardTitle>
              <p className="text-sm text-gray-600">
                Cliente: {payment.client?.name} | Monto disponible: {formatCurrency(payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0)))}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="size-4 text-blue-600" />
                <span className="font-medium text-blue-900">Resumen de Aplicación</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total seleccionado:</p>
                  <p className="font-semibold text-blue-900">{formatCurrency(getTotalSelected())}</p>
                </div>
                <div>
                  <p className="text-gray-600">Restante del pago:</p>
                  <p className="font-semibold text-blue-900">
                    {formatCurrency((payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0))) - getTotalSelected())}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Facturas seleccionadas:</p>
                  <p className="font-semibold text-blue-900">{applications.length}</p>
                </div>
              </div>
              {getTotalSelected() > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700">
                    ✓ Las facturas seleccionadas se marcarán como pagadas automáticamente
                  </p>
                </div>
              )}
            </div>

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
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
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
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleApply} 
                disabled={loading || applications.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="size-4 mr-2" />
                {loading ? 'Aplicando...' : 'Aplicar Pago'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
    </>
  );
};