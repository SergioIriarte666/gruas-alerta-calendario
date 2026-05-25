import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
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
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import DatePickerInput from '@/components/common/DatePickerInput';
import { getTodayLocal } from '@/utils/timezoneUtils';

interface SmartPaymentFormProps {
  onClose: () => void;
  preselectedClientId?: string;
  onPaymentCreated?: (paymentId: string, clientId: string) => void;
}
interface InvoiceSummary {
  id: string;
  folio: string;
  numero_fiscal?: string;
  total: number;
  remaining_amount: number;
  due_date: string;
  status: string;
}
export const SmartPaymentForm: React.FC<SmartPaymentFormProps> = ({
  onClose,
  preselectedClientId,
  onPaymentCreated
}) => {
  const {
    clients
  } = useClients();
  const {
    createPayment,
    getInvoicePaymentStatus,
    applyPaymentManual
  } = usePayments();
  const [formData, setFormData] = useState({
    client_id: preselectedClientId && preselectedClientId !== 'all' ? preselectedClientId : '',
    amount: '',
    payment_date: getTodayLocal(),
    bank_reference: '',
    payment_method: 'transferencia',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [clientInvoices, setClientInvoices] = useState<InvoiceSummary[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isAmountAutoCalculated, setIsAmountAutoCalculated] = useState(false);
  const [paymentStatusWarnings, setPaymentStatusWarnings] = useState<Record<string, string>>({});
  const batchProgress = useBatchProgress();

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

  // Auto-update amount when invoices are selected
  useEffect(() => {
    if (selectedInvoiceIds.length > 0) {
      const selectedTotal = getSelectedInvoicesTotal();
      setFormData(prev => ({
        ...prev,
        amount: selectedTotal.toString()
      }));
      setIsAmountAutoCalculated(true);
    } else if (isAmountAutoCalculated) {
      setFormData(prev => ({
        ...prev,
        amount: ''
      }));
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
        // Verificación segura del tipo
        if (status && typeof status === 'object' && 'has_automatic_payments' in status && status.has_automatic_payments) {
          warnings[invoiceId] = 'Esta factura fue marcada como pagada automáticamente';
        }
      } catch (error) {
        console.error('Error checking invoice payment status:', error);
      }
    }
    setPaymentStatusWarnings(warnings);
  };

  // Verificar estado de facturas cuando cambian las selecciones
  useEffect(() => {
    if (selectedInvoiceIds.length > 0) {
      checkInvoicePaymentStatus();
    } else {
      setPaymentStatusWarnings({});
    }
  }, [selectedInvoiceIds]);
  const fetchClientInvoices = async () => {
    if (!formData.client_id) return;
    try {
      const {
        data,
        error
      } = await supabase.from('invoices').select('id, folio, numero_fiscal, total, remaining_amount, due_date, status').eq('client_id', formData.client_id).in('status', ['draft', 'sent', 'overdue', 'partial']).not('folio', 'like', 'HIST-%').gt('remaining_amount', 0).order('due_date', {
        ascending: true
      });
      if (error) throw error;
      setClientInvoices(data || []);
    } catch (error) {
      console.error('Error fetching client invoices:', error);
    }
  };
  const checkForDuplicates = async () => {
    if (!formData.client_id || !formData.amount || !formData.payment_date) {
      setDuplicateWarning('');
      return;
    }
    try {
      const {
        data,
        error
      } = await supabase.from('payments').select('id, amount, payment_date, status').eq('client_id', formData.client_id).eq('amount', parseFloat(formData.amount)).eq('payment_date', formData.payment_date).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      if (data && data.length > 0) {
        setDuplicateWarning(`⚠️ Ya existe un pago similar por ${formatCurrency(parseFloat(formData.amount))} del ${formData.payment_date}`);
      } else {
        setDuplicateWarning('');
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  };
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
    return clientInvoices.filter(inv => selectedInvoiceIds.includes(inv.id)).reduce((sum, inv) => sum + (inv.remaining_amount || inv.total), 0);
  };
  const getPaymentRecommendation = () => {
    const paymentAmount = parseFloat(formData.amount) || 0;
    
    // Solo validar si hay facturas seleccionadas
    if (selectedInvoiceIds.length === 0) return null;
    if (paymentAmount === 0) return null;
    
    const selectedTotal = getSelectedInvoicesTotal();
    
    if (paymentAmount === selectedTotal) {
      return {
        type: 'perfect',
        message: `Monto exacto - ${selectedInvoiceIds.length === 1 ? 'La factura seleccionada será pagada' : `Las ${selectedInvoiceIds.length} facturas seleccionadas serán pagadas`} completamente`,
        icon: <CheckCircle className="size-4 text-green-500" />
      };
    } else {
      return {
        type: 'mismatch',
        message: `El monto debe ser exactamente ${formatCurrency(selectedTotal)} para ${selectedInvoiceIds.length === 1 ? 'la factura seleccionada' : `las ${selectedInvoiceIds.length} facturas seleccionadas`}`,
        icon: <AlertTriangle className="size-4 text-red-500" />
      };
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.amount) return;

    // Validar que el monto coincida exactamente con las facturas seleccionadas
    if (selectedInvoiceIds.length > 0) {
      const selectedTotal = getSelectedInvoicesTotal();
      const paymentAmount = parseFloat(formData.amount);
      if (selectedTotal !== paymentAmount) {
        toast.error(`El monto debe ser exactamente ${formatCurrency(selectedTotal)} para las facturas seleccionadas`);
        return;
      }
    }
    if (duplicateWarning && !confirm('Se detectó un posible duplicado. ¿Desea continuar?')) {
      return;
    }
    setLoading(true);
    
    // Iniciar progreso si hay facturas seleccionadas
    if (selectedInvoiceIds.length > 0) {
      batchProgress.start('Registrando y aplicando pago', selectedInvoiceIds.length + 1);
    }
    
    try {
      // Paso 1: Crear pago
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

      // Si hay facturas seleccionadas, aplicar el pago automáticamente
      if (selectedInvoiceIds.length > 0) {
        const applications = selectedInvoiceIds.map(invoiceId => {
          const invoice = clientInvoices.find(inv => inv.id === invoiceId);
          const amount = invoice?.remaining_amount || 0;
          return {
            invoice_id: invoiceId,
            amount
          };
        });
        
        // Mostrar progreso por cada factura
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
          if (onPaymentCreated) {
            onPaymentCreated(payment.id, formData.client_id);
          }
          onClose();
        }, 1500);
      } else {
        toast.success('Pago registrado exitosamente');
        if (onPaymentCreated) {
          onPaymentCreated(payment.id, formData.client_id);
        }
        onClose();
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      if (selectedInvoiceIds.length > 0) {
        batchProgress.error('Error al registrar el pago');
      }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-violet-600 to-violet-500 text-white -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="size-5" />
            Registrar Pago Inteligente
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cliente */}
            <div>
              <Label htmlFor="client">Cliente *</Label>
              <Select value={formData.client_id || undefined} onValueChange={value => setFormData({
              ...formData,
              client_id: value
            })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                  {clients.filter(c => c.isActive).map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">{toTitleCase(client.name)}</span>
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

            {/* Información del cliente y facturas */}
            {selectedClient && <Card className="bg-gray-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{toTitleCase(selectedClient.name)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {clientInvoices.length > 0 ? <>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Facturas pendientes:</span> {clientInvoices.length}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Total pendiente:</span> {formatCurrency(getTotalPendingAmount())}
                      </div>
                      
                       <div className="space-y-2">
                         <div className="text-sm font-medium text-gray-700 flex items-center justify-between">
                           <span>Próximas facturas a pagar:</span>
                           <label className="flex items-center gap-2 text-xs">
                             <input type="checkbox" checked={clientInvoices.length > 0 && selectedInvoiceIds.length === clientInvoices.length} onChange={e => handleSelectAllInvoices(e.target.checked)} className="size-3 rounded border border-gray-300 checked:bg-blue-600 checked:border-blue-600" />
                             Seleccionar todas
                           </label>
                         </div>
                         {(showAllInvoices ? clientInvoices : clientInvoices.slice(0, 3)).map(invoice => {
                    const isSelected = selectedInvoiceIds.includes(invoice.id);
                    return <div key={invoice.id} className={`flex justify-between items-center text-sm p-2 bg-white rounded border ${isSelected ? 'border-blue-500 bg-blue-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" checked={isSelected} onChange={e => handleInvoiceToggle(invoice.id, e.target.checked)} className="size-4 rounded border border-gray-300 checked:bg-blue-600 checked:border-blue-600" />
                                  <span className="font-medium">{invoice.numero_fiscal || invoice.folio}</span>
                                  <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                                    {invoice.status}
                                   </Badge>
                                   {invoice.due_date && (() => {
                                     const isOverdue = new Date(invoice.due_date + 'T12:00:00') < new Date();
                                     return (
                                       <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                         Vence: {format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                                       </span>
                                     );
                                   })()}
                                   {paymentStatusWarnings[invoice.id] && <Badge variant="outline" className="text-orange-600 border-orange-300">
                                       ⚠️ Pago automático
                                     </Badge>}
                                 </div>
                                 <span>{formatCurrency(invoice.remaining_amount || invoice.total)}</span>
                              </div>;
                  })}
                        {clientInvoices.length > 3 && <button type="button" onClick={() => setShowAllInvoices(!showAllInvoices)} className="text-xs text-blue-600 hover:text-blue-800 text-center w-full py-1 rounded hover:bg-blue-50 transition-colors">
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
              setFormData({
                ...formData,
                amount: e.target.value
              });
              setIsAmountAutoCalculated(false);
            }} placeholder="0.00" required className={isAmountAutoCalculated ? "border-green-300 bg-green-50" : ""} />
              
              {/* Recomendación de pago */}
              {recommendation && (
                <Alert className={`mt-2 ${recommendation.type === 'perfect' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    {recommendation.icon}
                    <AlertDescription>{recommendation.message}</AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Advertencias de conflictos de pago */}
              {Object.keys(paymentStatusWarnings).length > 0 && <Alert className="mt-2">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Algunas facturas seleccionadas ya tienen pagos automáticos aplicados. 
                    Proceda solo si está seguro de aplicar pagos adicionales.
                  </AlertDescription>
                </Alert>}

              {/* Advertencia de duplicado */}
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
                <Select value={formData.payment_method} onValueChange={value => setFormData({
                ...formData,
                payment_method: value
              })}>
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
            </div>

            <div>
              <Label htmlFor="bank_reference">Referencia Bancaria</Label>
              <Input id="bank_reference" value={formData.bank_reference} onChange={e => setFormData({
              ...formData,
              bank_reference: e.target.value
            })} placeholder="Número de referencia o comprobante" />
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" value={formData.notes} onChange={e => setFormData({
              ...formData,
              notes: e.target.value
            })} placeholder="Observaciones adicionales" rows={3} />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading || !!duplicateWarning} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
                {loading ? 'Procesando...' : 'Registrar Pago'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    
    <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
  </>;
};