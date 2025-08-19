import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Commission, PAYMENT_METHODS } from '@/types/commissions';

interface CreatePaymentBatchDialogProps {
  selectedCommissions: string[];
  commissions: Commission[];
  onSuccess: (batchData: {
    operator_id: string;
    commission_ids: string[];
    payment_method?: string;
    payment_reference?: string;
    notes?: string;
  }) => void;
  trigger: React.ReactNode;
}

export const CreatePaymentBatchDialog: React.FC<CreatePaymentBatchDialogProps> = ({
  selectedCommissions,
  commissions,
  onSuccess,
  trigger
}) => {
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedCommissionObjects = commissions.filter(c => selectedCommissions.includes(c.id));
  const totalAmount = selectedCommissionObjects.reduce((sum, c) => sum + c.amount, 0);
  const operatorId = selectedCommissionObjects[0]?.operator_id;
  const operatorName = selectedCommissionObjects[0]?.operators?.name || 'Operador desconocido';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSuccess({
      operator_id: operatorId,
      commission_ids: selectedCommissions,
      payment_method: paymentMethod || undefined,
      payment_reference: paymentReference || undefined,
      notes: notes || undefined,
    });
    
    setIsOpen(false);
    
    // Reset form
    setPaymentMethod('');
    setPaymentReference('');
    setNotes('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Lote de Pago</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Operador</Label>
            <Input value={operatorName} disabled />
          </div>
          
          <div className="space-y-2">
            <Label>Comisiones Seleccionadas</Label>
            <Input value={`${selectedCommissions.length} comisiones`} disabled />
          </div>
          
          <div className="space-y-2">
            <Label>Total a Pagar</Label>
            <Input value={formatCurrency(totalAmount)} disabled />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="payment_method">Método de Pago</Label>
            <Select value={paymentMethod || "none"} onValueChange={(value) => setPaymentMethod(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar método</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="payment_reference">Referencia de Pago</Label>
            <Input
              id="payment_reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Número de transferencia, cheque, etc."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Crear Lote de Pago
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};