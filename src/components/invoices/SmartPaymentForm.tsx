import React, { useState, useEffect } from 'react';
import { useClients } from '@/hooks/useClients';
import { usePayments } from '@/hooks/usePayments';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface SmartPaymentFormProps {
  onClose: () => void;
  preselectedClientId?: string;
}

interface InvoiceSummary {
  id: string;
  folio: string;
  total: number;
  remaining_amount: number;
  due_date: string;
  status: string;
}

export const SmartPaymentForm: React.FC<SmartPaymentFormProps> = ({ 
  onClose, 
  preselectedClientId 
}) => {
  const { clients } = useClients();
  const { createPayment, refetch } = usePayments();
  
  const [formData, setFormData] = useState({
    client_id: preselectedClientId && preselectedClientId !== 'all' ? preselectedClientId : '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    bank_reference: '',
    payment_method: 'transferencia',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [clientInvoices, setClientInvoices] = useState<InvoiceSummary[]>([]);
  const [paymentMode, setPaymentMode] = useState<'auto' | 'manual'>('auto');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');

  // Fetch client invoices when client changes
  useEffect(() => {
    if (formData.client_id) {
      fetchClientInvoices();
      checkForDuplicates();
    } else {
      setClientInvoices([]);
      setDuplicateWarning('');
    }
  }, [formData.client_id, formData.amount, formData.payment_date]);

  const fetchClientInvoices = async () => {
    if (!formData.client_id) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, folio, total, remaining_amount, due_date, status')
        .eq('client_id', formData.client_id)
        .in('status', ['sent', 'overdue'])
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      setClientInvoices(data || []);
    } catch (error) {
      console.error('Error fetching client invoices:', error);
    }
  };

  const checkForDuplicates = async () => {
    if (!formData.client_id || !formData.amount || !formData.payment_date) return;

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('id, bank_reference, amount')
        .eq('client_id', formData.client_id)
        .eq('payment_date', formData.payment_date)
        .eq('amount', parseFloat(formData.amount))
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setDuplicateWarning(`Posible duplicado: Ya existe un pago de ${formatCurrency(data[0].amount)} para esta fecha`);
      } else {
        setDuplicateWarning('');
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id || !formData.amount) {
      toast.error('Cliente y monto son requeridos');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      const paymentData = {
        ...formData,
        amount,
        applied_amount: 0,
        status: 'pending' as const,
        application_method: paymentMode === 'auto' ? 'automatic' as const : 'manual' as const
      };

      await createPayment(paymentData);
      toast.success('Pago registrado exitosamente');
      
      // Actualizar la lista de pagos
      await refetch();
      
      onClose();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    const variants = {
      sent: { color: 'bg-blue-500', icon: Clock },
      overdue: { color: 'bg-red-500', icon: AlertTriangle },
      paid: { color: 'bg-green-500', icon: CheckCircle }
    };
    
    const config = variants[status as keyof typeof variants] || variants.sent;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const totalPendingAmount = clientInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
  const paymentAmount = parseFloat(formData.amount) || 0;
  const coverage = totalPendingAmount > 0 ? (paymentAmount / totalPendingAmount) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Registrar Pago Inteligente</CardTitle>
            <p className="text-sm text-gray-600">Registra un nuevo pago y visualiza su impacto</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información del Pago</h3>
                
                <div>
                  <Label htmlFor="client_id">Cliente *</Label>
                  <Select 
                    value={formData.client_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="amount">Monto *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="payment_date">Fecha de Pago *</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="bank_reference">Referencia Bancaria</Label>
                  <Input
                    id="bank_reference"
                    value={formData.bank_reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_reference: e.target.value }))}
                    placeholder="Número de referencia"
                  />
                </div>

                <div>
                  <Label htmlFor="payment_method">Método de Pago</Label>
                  <Select 
                    value={formData.payment_method} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="deposito">Depósito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas adicionales..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Modo de Aplicación</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant={paymentMode === 'auto' ? 'default' : 'outline'}
                      onClick={() => setPaymentMode('auto')}
                      className="flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      Automático
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMode === 'manual' ? 'default' : 'outline'}
                      onClick={() => setPaymentMode('manual')}
                      className="flex items-center gap-2"
                    >
                      Manual
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {paymentMode === 'auto' 
                      ? 'El pago se aplicará automáticamente a las facturas más antiguas'
                      : 'Podrás seleccionar manualmente a qué facturas aplicar el pago'
                    }
                  </p>
                </div>
              </div>

              {/* Invoice Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Facturas Pendientes</h3>
                
                {duplicateWarning && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{duplicateWarning}</AlertDescription>
                  </Alert>
                )}

                {formData.client_id && clientInvoices.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium">Total Pendiente:</span>
                        <div className="text-lg font-bold text-blue-600">
                          {formatCurrency(totalPendingAmount)}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Cobertura:</span>
                        <div className="text-lg font-bold text-green-600">
                          {coverage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {clientInvoices.map(invoice => (
                        <div key={invoice.id} className="flex justify-between items-center p-2 bg-white rounded border">
                          <div>
                            <div className="font-medium">{invoice.folio}</div>
                            <div className="text-sm text-gray-600">
                              Vence: {new Date(invoice.due_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(invoice.remaining_amount)}</div>
                            {getInvoiceStatusBadge(invoice.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.client_id && clientInvoices.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Este cliente no tiene facturas pendientes.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Registrando...' : 'Registrar Pago'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};