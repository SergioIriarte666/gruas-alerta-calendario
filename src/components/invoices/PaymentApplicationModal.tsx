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

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    if (checked) {
      const invoice = availableInvoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        const invoiceRemaining = invoice.remaining_amount ?? (invoice.total - (invoice.paid_amount ?? 0));
        const paymentRemaining = payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0));
        const maxAmount = Math.min(invoiceRemaining, paymentRemaining - getTotalSelected());
        
        if (maxAmount > 0) {
          setApplications([...applications, { invoice_id: invoiceId, amount: maxAmount }]);
        } else {
          toast.error('No hay monto disponible para aplicar a esta factura');
        }
      }
    } else {
      setApplications(applications.filter(app => app.invoice_id !== invoiceId));
    }
  };

  const handleAmountChange = (invoiceId: string, amount: number) => {
    const invoice = availableInvoices.find(inv => inv.id === invoiceId);
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
    
    if (total <= 0 || total > available) {
      toast.error(`Monto inválido. Disponible: ${formatCurrency(available)}, Seleccionado: ${formatCurrency(total)}`);
      return;
    }

    if (!isValidApplication()) {
      toast.error('El monto total excede el disponible del pago');
      return;
    }

    setLoading(true);
    try {
      await applyPaymentManual(payment.id, applications);
      onClose();
    } catch (error) {
      console.error('Error applying payment:', error);
      toast.error('Error al aplicar el pago manualmente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Aplicar Pago Manualmente</CardTitle>
            <p className="text-sm text-gray-600">
              Cliente: {payment.client?.name} | Monto disponible: {formatCurrency(payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0)))}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Resumen de Aplicación</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Total seleccionado: {formatCurrency(getTotalSelected())}</div>
              <div>Restante: {formatCurrency((payment.remaining_amount ?? (payment.amount - (payment.applied_amount ?? 0))) - getTotalSelected())}</div>
            </div>
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
              {availableInvoices.map(invoice => {
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
                    <TableCell>{invoice.folio}</TableCell>
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
              <CheckCircle className="h-4 w-4 mr-2" />
              {loading ? 'Aplicando...' : 'Aplicar Pago'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};