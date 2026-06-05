import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDebtInstallments, DebtInstallment } from '@/hooks/useDebtInstallments';
import { PayInstallmentModal } from './PayInstallmentModal';
import { DebtWithProgress } from '@/hooks/useDebts';
import { CreditCard, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUpdateDebt } from '@/hooks/useDebts';
import DatePickerInput from '@/components/common/DatePickerInput';

interface DebtDetailModalProps {
  debt: DebtWithProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DebtDetailModal = ({ debt, open, onOpenChange }: DebtDetailModalProps) => {
  const { data: installments } = useDebtInstallments(debt.id);
  const [payingInstallment, setPayingInstallment] = useState<DebtInstallment | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    description: debt.description,
    total_amount: Number(debt.total_amount).toString(),
    installments_count: Number(debt.installments_count).toString(),
    currency: debt.currency || 'CLP',
    frequency: debt.frequency || 'monthly',
    first_due_date: debt.first_due_date,
    interest_enabled: debt.interest_enabled,
    interest_rate: debt.interest_rate?.toString() || '',
    adjustment_enabled: debt.adjustment_enabled,
    adjustment_rate: debt.adjustment_rate?.toString() || '',
  });
  const { mutate: updateDebt, isPending: updating } = useUpdateDebt();
  const today = format(new Date(), 'yyyy-MM-dd');

  const formatAmount = (amount: number, currency?: string) => {
    if (currency === 'UF') {
      return `UF ${Number(amount).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return `$${Number(amount).toLocaleString('es-CL')}`;
  };

  const getStatusBadge = (inst: DebtInstallment) => {
    if (inst.status === 'paid')
      return <Badge className="bg-green-100 text-green-800 text-xs">Pagada</Badge>;
    if (inst.due_date < today)
      return <Badge variant="destructive" className="text-xs">Vencida</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 text-xs">Pendiente</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {debt.description} — {debt.creditors?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              <Pencil className="size-3.5 mr-1" />
              {editing ? 'Cancelar edición' : 'Editar Deuda'}
            </Button>
          </div>

          {editing && (
            <div className="border rounded-lg p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLP">CLP</SelectItem>
                      <SelectItem value="UF">UF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto Total</Label>
                  <Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cantidad de Cuotas</Label>
                  <Input type="number" min="1" value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quincenal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Primera Cuota</Label>
                  <DatePickerInput value={form.first_due_date} onChange={(v) => setForm({ ...form, first_due_date: v })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Interés</Label>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.interest_enabled} onCheckedChange={(v) => setForm({ ...form, interest_enabled: v })} />
                    {form.interest_enabled && (
                      <Input type="number" step="0.01" placeholder="Tasa %" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Ajuste</Label>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.adjustment_enabled} onCheckedChange={(v) => setForm({ ...form, adjustment_enabled: v })} />
                    {form.adjustment_enabled && (
                      <Input type="number" step="0.01" placeholder="Tasa %" value={form.adjustment_rate} onChange={(e) => setForm({ ...form, adjustment_rate: e.target.value })} />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={updating}
                  onClick={() => {
                    updateDebt({
                      id: debt.id,
                      data: {
                        description: form.description,
                        total_amount: Number(form.total_amount),
                        installments_count: Number(form.installments_count),
                        currency: form.currency as any,
                        frequency: form.frequency,
                        first_due_date: form.first_due_date,
                        interest_enabled: form.interest_enabled,
                        interest_rate: form.interest_enabled ? Number(form.interest_rate) : null,
                        adjustment_enabled: form.adjustment_enabled,
                        adjustment_rate: form.adjustment_enabled ? Number(form.adjustment_rate) : null,
                      },
                    });
                    setEditing(false);
                  }}
                >
                  {updating ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-foreground">{formatAmount(Number(debt.total_amount), debt.currency)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="text-lg font-bold text-green-700">{formatAmount(Number(debt.paid_amount), debt.currency)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className="text-lg font-bold text-amber-700">{formatAmount(Number(debt.pending_amount), debt.currency)}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Pago</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments?.map((inst) => (
                <TableRow key={inst.id} className={inst.due_date < today && inst.status === 'pending' ? 'bg-red-50/50' : ''}>
                  <TableCell className="text-foreground">{inst.installment_number}</TableCell>
                  <TableCell className="text-foreground">
                    {format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    {formatAmount(Number(inst.total_amount), debt.currency)}
                  </TableCell>
                  <TableCell>{getStatusBadge(inst)}</TableCell>
                  <TableCell className="text-foreground">
                    {inst.paid_date ? format(new Date(inst.paid_date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {inst.status === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => setPayingInstallment(inst)}>
                        <CreditCard className="size-3.5 mr-1" /> Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {payingInstallment && (
        <PayInstallmentModal
          installment={payingInstallment}
          open={!!payingInstallment}
          onOpenChange={(open) => !open && setPayingInstallment(null)}
        />
      )}
    </>
  );
};
