import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthlyInstallments, DebtInstallment } from '@/hooks/useDebtInstallments';
import { PayInstallmentModal } from './PayInstallmentModal';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { businessClock } from '@/utils/businessClock';

export const MonthlyInstallments = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [payingInstallment, setPayingInstallment] = useState<DebtInstallment | null>(null);
  const { data: installments, isLoading } = useMonthlyInstallments(currentMonth);

  const today = businessClock.today();

  const formatAmount = (amount: number, currency?: string) => {
    if (currency === 'UF') {
      return `UF ${Number(amount).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return `$${Number(amount).toLocaleString('es-CL')}`;
  };

  const getStatusBadge = (inst: DebtInstallment) => {
    if (inst.status === 'paid')
      return <Badge variant="outline" className="border-success/30 bg-success-soft text-xs text-success-text">Pagada</Badge>;
    if (inst.due_date < today)
      return <Badge variant="destructive" className="text-xs">Vencida</Badge>;
    return <Badge variant="outline" className="border-warning/30 bg-warning-soft text-xs text-warning-text">Pendiente</Badge>;
  };

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>;
  }

  return (
    <>
      <Card className="finance-panel border border-border">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <CardTitle className="text-base font-semibold text-foreground capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Acreedor</TableHead>
                <TableHead>Deuda</TableHead>
                <TableHead>Cuota #</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!installments || installments.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay cuotas para este mes
                  </TableCell>
                </TableRow>
              ) : (
                installments.map((inst) => (
                  <TableRow key={inst.id} className={inst.due_date < today && inst.status === 'pending' ? 'bg-danger-soft/50' : ''}>
                    <TableCell className="text-foreground font-medium">
                      {format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {inst.debts?.creditors?.name || '-'}
                    </TableCell>
                    <TableCell className="text-foreground">{inst.debts?.description || '-'}</TableCell>
                    <TableCell className="text-foreground">{inst.installment_number}</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {formatAmount(Number(inst.total_amount), inst.debts?.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(inst)}</TableCell>
                    <TableCell>
                      {inst.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPayingInstallment(inst)}
                        >
                          <CreditCard className="size-3.5 mr-1" />
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

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
