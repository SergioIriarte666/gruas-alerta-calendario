import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CalendarClock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDebtsWithProgress } from '@/hooks/useDebts';
import { useMonthlyInstallments } from '@/hooks/useDebtInstallments';
import { format } from 'date-fns';

export const APDashboardCards = () => {
  const { data: debts } = useDebtsWithProgress();
  const { data: monthlyInstallments } = useMonthlyInstallments();

  const totalPending = debts?.reduce((s, d) => s + d.pending_amount, 0) || 0;
  const totalOverdue = debts?.reduce((s, d) => s + d.overdue_count, 0) || 0;

  const monthlyTotal = monthlyInstallments
    ?.filter((i) => i.status === 'pending')
    .reduce((s, i) => s + Number(i.total_amount), 0) || 0;

  const monthlyPaid = monthlyInstallments
    ?.filter((i) => i.status === 'paid')
    .reduce((s, i) => s + Number(i.paid_amount || 0), 0) || 0;

  const cards = [
    {
      title: 'Deuda Total Vigente',
      value: `$${totalPending.toLocaleString('es-CL')}`,
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Cuotas del Mes',
      value: `$${monthlyTotal.toLocaleString('es-CL')}`,
      subtitle: `${monthlyInstallments?.filter((i) => i.status === 'pending').length || 0} pendientes`,
      icon: CalendarClock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Cuotas Vencidas',
      value: String(totalOverdue),
      icon: AlertTriangle,
      color: totalOverdue > 0 ? 'text-red-600' : 'text-gray-400',
      bg: totalOverdue > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
    {
      title: 'Pagado este Mes',
      value: `$${monthlyPaid.toLocaleString('es-CL')}`,
      subtitle: `${monthlyInstallments?.filter((i) => i.status === 'paid').length || 0} cuotas`,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                <p className="text-xl font-bold text-foreground mt-1">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
