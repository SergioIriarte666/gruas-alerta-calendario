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
import { formatCurrency } from '@/lib/utils';
import DatePickerInput from '@/components/common/DatePickerInput';
import { businessClock } from '@/utils/businessClock';

interface PayInstallmentModalProps {
  installment: DebtInstallment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PayInstallmentModal = ({ installment, open, onOpenChange }: PayInstallmentModalProps) => {
  const [paymentDate, setPaymentDate] = useState(businessClock.today());
  const [method, setMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');
  const [ufValue, setUfValue] = useState<string>('');
  const { mutate: pay, isPending } = usePayInstallment();

  const isUF = installment.debts?.currency === 'UF';
  const installmentAmount = Number(installment.total_amount);
  const ufValueNumber = Number(ufValue);
  const clpAmount = isUF && ufValueNumber > 0 ? Math.round(installmentAmount * ufValueNumber) : Math.round(installmentAmount);

  const displayInstallmentAmount = isUF
    ? `UF ${installmentAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
    : `$${installmentAmount.toLocaleString('es-CL')}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDate) return;
    pay(
      {
        installment,
        paymentDate,
        method,
        notes,
        uf_value: isUF ? ufValueNumber : null,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Pago de Cuota</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">
              {installment.debts?.description} — {installment.debts?.creditors?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Cuota #{installment.installment_number} · Vence: {businessClock.format(installment.due_date, 'dd/MM/yyyy')}
            </p>
            <p className="text-lg font-bold text-foreground">
              {displayInstallmentAmount}
            </p>
            {isUF && (
              <p className="text-xs text-muted-foreground">
                Pago en CLP: <span className="font-medium text-foreground">{formatCurrency(clpAmount, 'CLP')}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <DatePickerInput value={paymentDate} onChange={setPaymentDate} />
          </div>

          {isUF && (
            <div className="space-y-2">
              <Label>Valor UF (CLP)</Label>
              <Input
                type="number"
                step="0.01"
                value={ufValue}
                onChange={(e) => setUfValue(e.target.value)}
                required
              />
            </div>
          )}

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

          <p className="text-xs text-muted-foreground">
            Las asociaciones (centro de costo, grúa, operador, subcategoría) se heredan desde la deuda.
          </p>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !paymentDate || (isUF && (!ufValue || ufValueNumber <= 0))}>
              {isPending ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
