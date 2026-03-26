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
import { useCostCenters } from '@/hooks/useCostCenters';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { formatCurrency } from '@/lib/utils';
import DatePickerInput from '@/components/common/DatePickerInput';

interface PayInstallmentModalProps {
  installment: DebtInstallment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PayInstallmentModal = ({ installment, open, onOpenChange }: PayInstallmentModalProps) => {
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [method, setMethod] = useState('transferencia');
  const [notes, setNotes] = useState('');
  const [costCenterId, setCostCenterId] = useState<string>('none');
  const [craneId, setCraneId] = useState<string>('none');
  const [operatorId, setOperatorId] = useState<string>('none');
  const [ufValue, setUfValue] = useState<string>('');
  const { mutate: pay, isPending } = usePayInstallment();
  const { data: costCenters = [] } = useCostCenters();
  const { cranes = [] } = useCranes();
  const { operators = [] } = useOperators();

  const isUF = installment.debts?.currency === 'UF';
  const installmentAmount = Number(installment.total_amount);
  const ufValueNumber = Number(ufValue);
  const clpAmount = isUF && ufValueNumber > 0 ? Math.round(installmentAmount * ufValueNumber) : Math.round(installmentAmount);

  const displayInstallmentAmount = isUF
    ? `UF ${installmentAmount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
    : `$${installmentAmount.toLocaleString('es-CL')}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    pay(
      {
        installment,
        paymentDate,
        method,
        notes,
        cost_center_id: costCenterId === 'none' ? null : costCenterId,
        crane_id: craneId === 'none' ? null : craneId,
        operator_id: operatorId === 'none' ? null : operatorId,
        uf_value: isUF ? ufValueNumber : null,
      },
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Centro de costo</Label>
              <Select value={costCenterId} onValueChange={setCostCenterId}>
                <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asociar</SelectItem>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grúa</Label>
              <Select value={craneId} onValueChange={setCraneId}>
                <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asociar</SelectItem>
                  {cranes.map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.licensePlate} - {crane.brand} {crane.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operador</Label>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asociar</SelectItem>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || (isUF && (!ufValue || ufValueNumber <= 0))}>
              {isPending ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
