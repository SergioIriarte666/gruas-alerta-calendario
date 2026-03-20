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
import { CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface DebtDetailModalProps {
  debt: DebtWithProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DebtDetailModal = ({ debt, open, onOpenChange }: DebtDetailModalProps) => {
  const { data: installments } = useDebtInstallments(debt.id);
  const [payingInstallment, setPayingInstallment] = useState<DebtInstallment | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {debt.description} — {debt.creditors?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-foreground">${Number(debt.total_amount).toLocaleString('es-CL')}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="text-lg font-bold text-green-700">${debt.paid_amount.toLocaleString('es-CL')}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className="text-lg font-bold text-amber-700">${debt.pending_amount.toLocaleString('es-CL')}</p>
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
                    ${Number(inst.total_amount).toLocaleString('es-CL')}
                  </TableCell>
                  <TableCell>{getStatusBadge(inst)}</TableCell>
                  <TableCell className="text-foreground">
                    {inst.paid_date ? format(new Date(inst.paid_date + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {inst.status === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => setPayingInstallment(inst)}>
                        <CreditCard className="h-3.5 w-3.5 mr-1" /> Pagar
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
