import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDebtInstallments, DebtInstallment } from '@/hooks/useDebtInstallments';
import { PayInstallmentModal } from './PayInstallmentModal';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export const DebtCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [payingInstallment, setPayingInstallment] = useState<DebtInstallment | null>(null);
  const { data: installments } = useDebtInstallments();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const today = format(new Date(), 'yyyy-MM-dd');

  const formatAmount = (amount: number, currency?: string) => {
    if (currency === 'UF') {
      return `UF ${Number(amount).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return `$${Number(amount).toLocaleString('es-CL')}`;
  };

  const getInstallmentsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (installments || []).filter((i) => i.due_date === dateStr);
  };

  return (
    <>
      <Card className="border border-border">
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
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Offset for first day */}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const dayInstallments = getInstallmentsForDay(day);
              const hasOverdue = dayInstallments.some((i) => i.status === 'pending' && i.due_date < today);
              const hasPending = dayInstallments.some((i) => i.status === 'pending');
              const allPaid = dayInstallments.length > 0 && dayInstallments.every((i) => i.status === 'paid');

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[60px] rounded-md border p-1 text-xs ${
                    isToday(day) ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="font-medium text-foreground">{format(day, 'd')}</div>
                  {dayInstallments.slice(0, 2).map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => inst.status === 'pending' && setPayingInstallment(inst)}
                      className={`w-full text-left truncate rounded px-1 py-0.5 mt-0.5 text-[10px] ${
                        inst.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : inst.due_date < today
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {formatAmount(Number(inst.total_amount), inst.debts?.currency)}
                    </button>
                  ))}
                  {dayInstallments.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{dayInstallments.length - 2} más</span>
                  )}
                </div>
              );
            })}
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
