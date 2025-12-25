import React, { useState, useEffect } from 'react';
import { useClients } from '@/hooks/useClients';
import { usePayments } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, FileText, Calendar } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';

interface PaymentFormProps {
  onClose: () => void;
  onCancel: () => void;
  preselectedClientId?: string;
}

interface InvoiceSelection {
  invoice_id: string;
  amount: number;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ onClose, onCancel, preselectedClientId }) => {
  const { clients } = useClients();
  const { createPayment, applyPaymentManual, getUnpaidInvoicesForClient } = usePayments();
  
  const [formData, setFormData] = useState({
    client_id: preselectedClientId && preselectedClientId !== 'all' ? preselectedClientId : '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    bank_reference: '',
    payment_method: 'transferencia',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState<'general' | 'specific'>('specific');
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<InvoiceSelection[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Fetch unpaid invoices when client changes
  useEffect(() => {
    if (formData.client_id && paymentType === 'specific') {
      fetchUnpaidInvoices();
    } else {
      setUnpaidInvoices([]);
      setSelectedInvoices([]);
    }
  }, [formData.client_id, paymentType]);

  const fetchUnpaidInvoices = async () => {
    if (!formData.client_id) return;
    
    setLoadingInvoices(true);
    try {
      const invoices = await getUnpaidInvoicesForClient(formData.client_id);
      setUnpaidInvoices(invoices);
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    if (checked) {
      const invoice = unpaidInvoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        const amount = invoice.remaining_amount || invoice.total || 0;
        setSelectedInvoices(prev => [...prev, {
          invoice_id: invoiceId,
          amount: amount
        }]);
      }
    } else {
      setSelectedInvoices(prev => prev.filter(sel => sel.invoice_id !== invoiceId));
    }
  };

  const handleInvoiceAmountChange = (invoiceId: string, amount: number) => {
    setSelectedInvoices(prev => 
      prev.map(sel => 
        sel.invoice_id === invoiceId 
          ? { ...sel, amount: Math.max(0, amount) }
          : sel
      )
    );
  };

  const getTotalSelectedAmount = () => {
    return selectedInvoices.reduce((sum, sel) => sum + sel.amount, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.amount) return;

    const paymentAmount = parseFloat(formData.amount);
    
    if (paymentType === 'specific') {
      const totalSelected = getTotalSelectedAmount();
      if (paymentAmount !== totalSelected) {
        alert(`El monto del pago ($${paymentAmount}) debe coincidir con el total seleccionado ($${totalSelected})`);
        return;
      }
      if (selectedInvoices.length === 0) {
        alert('Debe seleccionar al menos una factura para pago específico');
        return;
      }
    }

    setLoading(true);
    try {
      console.log('🔍 Starting payment process:', { paymentType, selectedInvoices, paymentAmount });
      
      // Create the payment first
      const payment = await createPayment({
        client_id: formData.client_id,
        amount: paymentAmount,
        payment_date: formData.payment_date,
        bank_reference: formData.bank_reference || undefined,
        payment_method: formData.payment_method,
        notes: formData.notes || undefined,
        status: 'pending' // Always start as pending, then apply if needed
      });

      console.log('✅ Payment created:', payment);

      // If specific payment, apply to selected invoices
      if (paymentType === 'specific' && selectedInvoices.length > 0) {
        console.log('🔍 Applying payment to specific invoices:', selectedInvoices);
        await applyPaymentManual(payment.id, selectedInvoices);
      }

      onClose();
    } catch (error) {
      console.error('🚨 Error in payment process:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registrar Nuevo Pago</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payment Type Selection */}
            <div>
              <Label>Tipo de Pago</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="paymentType"
                    value="specific"
                    checked={paymentType === 'specific'}
                    onChange={(e) => setPaymentType(e.target.value as 'general' | 'specific')}
                    className="text-primary"
                  />
                  <span>Pago a facturas específicas</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="paymentType"
                    value="general"
                    checked={paymentType === 'general'}
                    onChange={(e) => setPaymentType(e.target.value as 'general' | 'specific')}
                    className="text-primary"
                  />
                  <span>Pago general</span>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="client">Cliente *</Label>
              <Select 
                value={formData.client_id || undefined} 
                onValueChange={(value) => setFormData({...formData, client_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">{client.name}</span>
                        {client.department && client.department !== 'General' && (
                          <span className="text-xs text-violet-600 dark:text-violet-400">
                            {client.department}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Selection for Specific Payments */}
            {paymentType === 'specific' && formData.client_id && (
              <div>
                <Label>Facturas Pendientes</Label>
                {loadingInvoices ? (
                  <div className="text-sm text-muted-foreground">Cargando facturas...</div>
                ) : unpaidInvoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay facturas pendientes para este cliente</div>
                ) : (
                  <div className="border rounded-md p-4 space-y-3 max-h-48 overflow-y-auto">
                    {unpaidInvoices.map((invoice) => {
                      const isSelected = selectedInvoices.some(sel => sel.invoice_id === invoice.id);
                      const selectedInvoice = selectedInvoices.find(sel => sel.invoice_id === invoice.id);
                      
                      return (
                        <div key={invoice.id} className="flex items-center space-x-3 p-2 border rounded">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleInvoiceToggle(invoice.id, checked as boolean)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{invoice.numero_fiscal || invoice.folio}</span>
                              <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                                {invoice.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Vence: {new Date(invoice.due_date).toLocaleDateString()}
                              </span>
                              <span>Total: ${invoice.total.toLocaleString()}</span>
                              <span>Pendiente: ${(invoice.remaining_amount || invoice.total).toLocaleString()}</span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-24">
                              <Input
                                type="number"
                                step="0.01"
                                value={selectedInvoice?.amount || 0}
                                onChange={(e) => handleInvoiceAmountChange(invoice.id, parseFloat(e.target.value) || 0)}
                                className="text-right"
                                placeholder="Monto"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {selectedInvoices.length > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-center font-medium">
                          <span>Total Seleccionado:</span>
                          <span>${getTotalSelectedAmount().toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="amount">Monto *</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  required
                />
                {paymentType === 'specific' && selectedInvoices.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({...formData, amount: getTotalSelectedAmount().toString()})}
                  >
                    Auto
                  </Button>
                )}
              </div>
              {paymentType === 'specific' && parseFloat(formData.amount) !== getTotalSelectedAmount() && selectedInvoices.length > 0 && (
                <div className="text-sm text-orange-600 mt-1">
                  El monto debe coincidir con el total seleccionado (${getTotalSelectedAmount().toLocaleString()})
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="payment_date">Fecha de Pago *</Label>
              <DatePickerInput
                id="payment_date"
                value={formData.payment_date}
                onChange={(value) => setFormData({...formData, payment_date: value})}
                placeholder="Seleccionar fecha"
              />
            </div>

            <div>
              <Label htmlFor="bank_reference">Referencia Bancaria</Label>
              <Input
                id="bank_reference"
                value={formData.bank_reference}
                onChange={(e) => setFormData({...formData, bank_reference: e.target.value})}
                placeholder="Número de referencia"
              />
            </div>

            <div>
              <Label htmlFor="payment_method">Método de Pago</Label>
              <Select value={formData.payment_method} onValueChange={(value) => setFormData({...formData, payment_method: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Observaciones adicionales"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {loading ? 'Guardando...' : 'Registrar Pago'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};