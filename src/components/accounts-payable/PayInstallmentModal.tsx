import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayInstallment, DebtInstallment } from '@/hooks/useDebtInstallments';
import { format } from 'date-fns';

interface PayInstallmentModalProps {
  installment: DebtInstallment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PayInstallmentModal = ({ installment, open, onOpenChange }: PayInstallmentModalProps) => {
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [method, setMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');
  const { mutate: pay, isPending } = usePayInstallment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    pay(
      { installment, paymentDate, method, notes },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Pago de Cuota</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">
              {installment.debts?.description} — {installment.debts?.creditors?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Cuota #{installment.installment_number} · Vence: {format(new Date(installment.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
            </p>
            <p className="text-lg font-bold text-foreground">
              ${Number(installment.total_amount).toLocaleString('es-CL')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
