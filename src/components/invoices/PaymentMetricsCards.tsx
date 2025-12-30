import { useMemo } from 'react';
import { Clock, CheckCircle, TrendingUp, Wallet } from 'lucide-react';
import { PaymentWithDetails } from '@/types/payments';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description: string;
  iconColor: string;
  iconBgColor: string;
  showSensitiveData?: boolean;
}

const MetricCard = ({ 
  icon: Icon, 
  title, 
  value, 
  description, 
  iconColor, 
  iconBgColor,
  showSensitiveData = true 
}: MetricCardProps) => (
  <div className="bg-white dark:bg-gray-900 rounded-lg border p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-violet-600 mt-1">
          {showSensitiveData ? value : '••••••'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {showSensitiveData ? description : '••••••'}
        </p>
      </div>
      <div className={`p-2 rounded-lg ${iconBgColor}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  </div>
);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

interface PaymentMetricsCardsProps {
  payments: PaymentWithDetails[];
  showSensitiveData?: boolean;
}

export const PaymentMetricsCards = ({ 
  payments, 
  showSensitiveData = true 
}: PaymentMetricsCardsProps) => {
  const metrics = useMemo(() => {
    const pending = payments.filter(p => p.status === 'pending');
    const applied = payments.filter(p => p.status === 'applied');
    const partial = payments.filter(p => p.status === 'partial');
    
    const pendingAmount = pending.reduce((sum, p) => sum + p.remaining_amount, 0);
    const appliedAmount = applied.reduce((sum, p) => sum + p.applied_amount, 0);
    const partialAmount = partial.reduce((sum, p) => sum + p.applied_amount, 0);
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      pending: { count: pending.length, amount: pendingAmount },
      applied: { count: applied.length, amount: appliedAmount },
      partial: { count: partial.length, amount: partialAmount },
      total: totalCollected,
    };
  }, [payments]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon={Clock}
        title="Pagos Pendientes"
        value={metrics.pending.count}
        description={`${formatCurrency(metrics.pending.amount)} por aplicar`}
        iconColor="text-amber-600"
        iconBgColor="bg-amber-50"
        showSensitiveData={showSensitiveData}
      />
      <MetricCard
        icon={CheckCircle}
        title="Pagos Aplicados"
        value={metrics.applied.count}
        description={`${formatCurrency(metrics.applied.amount)} aplicados`}
        iconColor="text-green-600"
        iconBgColor="bg-green-50"
        showSensitiveData={showSensitiveData}
      />
      <MetricCard
        icon={TrendingUp}
        title="Pagos Parciales"
        value={metrics.partial.count}
        description={`${formatCurrency(metrics.partial.amount)} en proceso`}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-50"
        showSensitiveData={showSensitiveData}
      />
      <MetricCard
        icon={Wallet}
        title="Total Recaudado"
        value={formatCurrency(metrics.total)}
        description={`${payments.length} pagos registrados`}
        iconColor="text-violet-600"
        iconBgColor="bg-violet-50"
        showSensitiveData={showSensitiveData}
      />
    </div>
  );
};
