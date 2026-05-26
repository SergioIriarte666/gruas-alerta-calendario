import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CalendarClock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDebtsWithProgress } from '@/hooks/useDebts';
import { useMonthlyInstallments } from '@/hooks/useDebtInstallments';

export const APDashboardCards = () => {
  const { data: debts } = useDebtsWithProgress();
  const { data: monthlyInstallments } = useMonthlyInstallments();

  const totalPendingCLP = debts?.filter(d => d.currency !== 'UF').reduce((s, d) => s + Number(d.pending_amount || 0), 0) || 0;
  const totalPendingUF = debts?.filter(d => d.currency === 'UF').reduce((s, d) => s + Number(d.pending_amount || 0), 0) || 0;
  const totalOverdue = debts?.reduce((s, d) => s + d.overdue_count, 0) || 0;

  const monthlyPendingCLP = monthlyInstallments
    ?.filter((i) => i.status === 'pending' && i.debts?.currency !== 'UF')
    .reduce((s, i) => s + Number(i.total_amount), 0) || 0;
  const monthlyPendingUF = monthlyInstallments
    ?.filter((i) => i.status === 'pending' && i.debts?.currency === 'UF')
    .reduce((s, i) => s + Number(i.total_amount), 0) || 0;

  const monthlyPaidCLP = monthlyInstallments
    ?.filter((i) => i.status === 'paid' && i.debts?.currency !== 'UF')
    .reduce((s, i) => s + Number(i.paid_amount || 0), 0) || 0;
  const monthlyPaidUF = monthlyInstallments
    ?.filter((i) => i.status === 'paid' && i.debts?.currency === 'UF')
    .reduce((s, i) => s + Number(i.paid_amount || 0), 0) || 0;

  const formatUF = (amount: number) => `UF ${Number(amount).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

  const cards = [
    {
      title: 'Deuda Total Vigente',
      value: totalPendingCLP > 0 ? `$${totalPendingCLP.toLocaleString('es-CL')}` : (totalPendingUF > 0 ? formatUF(totalPendingUF) : '$0'),
      subtitle: totalPendingCLP > 0 && totalPendingUF > 0 ? formatUF(totalPendingUF) : undefined,
      icon: DollarSign,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      title: 'Cuotas del Mes',
      value: monthlyPendingCLP > 0 ? `$${monthlyPendingCLP.toLocaleString('es-CL')}` : (monthlyPendingUF > 0 ? formatUF(monthlyPendingUF) : '$0'),
      subtitle: [
        `${monthlyInstallments?.filter((i) => i.status === 'pending').length || 0} pendientes`,
        monthlyPendingCLP > 0 && monthlyPendingUF > 0 ? formatUF(monthlyPendingUF) : null
      ].filter(Boolean).join(' · '),
      icon: CalendarClock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Cuotas Vencidas',
      value: String(totalOverdue),
      icon: AlertTriangle,
      color: totalOverdue > 0 ? 'text-danger' : 'text-muted-foreground',
      bg: totalOverdue > 0 ? 'bg-danger/10' : 'bg-muted/40',
    },
    {
      title: 'Pagado este Mes',
      value: monthlyPaidCLP > 0 ? `$${monthlyPaidCLP.toLocaleString('es-CL')}` : (monthlyPaidUF > 0 ? formatUF(monthlyPaidUF) : '$0'),
      subtitle: [
        `${monthlyInstallments?.filter((i) => i.status === 'paid').length || 0} cuotas`,
        monthlyPaidCLP > 0 && monthlyPaidUF > 0 ? formatUF(monthlyPaidUF) : null
      ].filter(Boolean).join(' · '),
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
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
                <card.icon className={`size-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
