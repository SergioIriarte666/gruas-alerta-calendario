import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePayments } from '@/hooks/usePayments';
import { toast } from 'sonner';
import { PaymentWithDetails } from '@/types/payments';
import { X, AlertTriangle, Check, Undo2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface PaymentApplication {
  id: string;
  applied_amount: number;
  application_method: string;
  created_at: string;
  invoices: {
    id: string;
    folio: string;
    numero_fiscal: string;
    total: number;
    paid_amount: number;
    status: string;
  };
}

interface PaymentCorrectionModalProps {
  payment: PaymentWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentCorrectionModal({ payment, isOpen, onClose }: PaymentCorrectionModalProps) {
  const { 
    getPaymentApplicationDetails, 
    revertPaymentApplications, 
    applyPaymentToSpecificInvoices 
  } = usePayments();
  
  const [currentApplications, setCurrentApplications] = useState<PaymentApplication[]>([]);
  const [selectedApplicationsToRevert, setSelectedApplicationsToRevert] = useState<string[]>([]);
  const [newFiscalNumbers, setNewFiscalNumbers] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'review' | 'revert' | 'apply'>('review');

  useEffect(() => {
    if (payment && isOpen) {
      loadApplicationDetails();
    }
  }, [payment, isOpen]);

  const loadApplicationDetails = async () => {
    if (!payment) return;
    
    try {
      setLoading(true);
      const applications = await getPaymentApplicationDetails(payment.id);
      setCurrentApplications(applications);
    } catch (error) {
      console.error('Error loading application details:', error);
      toast.error('Error al cargar detalles de aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleRevertApplications = async () => {
    if (!payment || selectedApplicationsToRevert.length === 0) return;

    try {
      setLoading(true);
      await revertPaymentApplications(payment.id, selectedApplicationsToRevert);
      await loadApplicationDetails();
      setSelectedApplicationsToRevert([]);
      setStep('apply');
      toast.success('Aplicaciones revertidas exitosamente');
    } catch (error) {
      console.error('Error reverting applications:', error);
      toast.error('Error al revertir aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToSpecificInvoices = async () => {
    if (!payment || !newFiscalNumbers.trim()) return;

    try {
      setLoading(true);
      const fiscalNumbers = newFiscalNumbers
        .split(',')
        .map(fn => fn.trim())
        .filter(fn => fn.length > 0);

      await applyPaymentToSpecificInvoices(payment.id, fiscalNumbers);
      await loadApplicationDetails();
      setNewFiscalNumbers('');
      toast.success('Pago aplicado exitosamente a las facturas especificadas');
      onClose();
    } catch (error) {
      console.error('Error applying to specific invoices:', error);
      toast.error('Error al aplicar pago a facturas específicas');
    } finally {
      setLoading(false);
    }
  };

  const toggleApplicationSelection = (applicationId: string) => {
    setSelectedApplicationsToRevert(prev => 
      prev.includes(applicationId)
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  };

  const totalCurrentlyApplied = currentApplications.reduce((sum, app) => sum + app.applied_amount, 0);
  const remainingAmount = payment ? payment.amount - totalCurrentlyApplied : 0;

  if (!payment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Corregir Aplicación de Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-medium mb-2">Resumen del Pago</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cliente:</span> {payment.client?.name}
              </div>
              <div>
                <span className="text-muted-foreground">Monto Total:</span> ${payment.amount.toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">Fecha:</span> {payment.payment_date}
              </div>
              <div>
                <span className="text-muted-foreground">Referencia:</span> {payment.bank_reference || 'N/A'}
              </div>
            </div>
          </div>

          {/* Current Applications */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              Aplicaciones Actuales
              <Badge variant="secondary">
                ${totalCurrentlyApplied.toLocaleString()} aplicado
              </Badge>
              {remainingAmount > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  ${remainingAmount.toLocaleString()} restante
                </Badge>
              )}
            </h3>

            {currentApplications.length === 0 ? (
              <p className="text-muted-foreground">No hay aplicaciones actuales</p>
            ) : (
              <div className="space-y-2">
                {currentApplications.map((application) => (
                  <div 
                    key={application.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedApplicationsToRevert.includes(application.id)}
                        onCheckedChange={() => toggleApplicationSelection(application.id)}
                      />
                      <div>
                        <div className="font-medium">
                          {application.invoices.folio} (#{application.invoices.numero_fiscal})
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total factura: ${application.invoices.total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${application.applied_amount.toLocaleString()}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {application.application_method}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            {step === 'review' && selectedApplicationsToRevert.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-800 mb-2">
                  Revertir Aplicaciones Seleccionadas
                </h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Se revertirán {selectedApplicationsToRevert.length} aplicaciones por un total de $
                  {currentApplications
                    .filter(app => selectedApplicationsToRevert.includes(app.id))
                    .reduce((sum, app) => sum + app.applied_amount, 0)
                    .toLocaleString()}
                </p>
                <Button 
                  onClick={handleRevertApplications}
                  disabled={loading}
                  variant="outline"
                  className="border-yellow-500 text-yellow-700 hover:bg-yellow-500 hover:text-white"
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revertir Seleccionadas
                </Button>
              </div>
            )}

            {(step === 'apply' || remainingAmount > 0) && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">
                  Aplicar a Facturas Específicas
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="fiscal-numbers">
                      Números Fiscales (separados por comas)
                    </Label>
                    <Input
                      id="fiscal-numbers"
                      value={newFiscalNumbers}
                      onChange={(e) => setNewFiscalNumbers(e.target.value)}
                      placeholder="3779, 3781, 3782, 3783, 3784"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ej: 3779, 3781, 3782, 3783, 3784
                    </p>
                  </div>
                  <Button 
                    onClick={handleApplyToSpecificInvoices}
                    disabled={loading || !newFiscalNumbers.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Aplicar a Facturas
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}