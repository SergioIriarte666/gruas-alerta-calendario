import { FileText, Clock, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Invoice } from '@/types';
import { useMemo } from 'react';

interface InvoicesMetricsCardsProps {
  invoices: Invoice[];
  showSensitiveData?: boolean;
}

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description: string;
  iconColor: string;
  iconBgColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  showSensitiveData?: boolean;
}

const MetricCard = ({ 
  icon: Icon, 
  title, 
  value, 
  description, 
  iconColor, 
  iconBgColor, 
  trend,
  showSensitiveData = true 
}: MetricCardProps) => (
  <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-violet-600 mt-1">
          {showSensitiveData ? value : '••••••'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && showSensitiveData && (
            <div className={`flex items-center text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
      </div>
      <div className={`p-2 rounded-lg ${iconBgColor}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  </div>
);

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

export const InvoicesMetricsCards = ({ invoices, showSensitiveData = true }: InvoicesMetricsCardsProps) => {
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Total facturado
    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    
    // Pendientes (draft + sent + overdue)
    const pendingInvoices = invoices.filter(inv => 
      inv.status === 'draft' || inv.status === 'sent' || inv.status === 'overdue'
    );
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    
    // Calculate average days pending
    let totalDaysPending = 0;
    pendingInvoices.forEach(inv => {
      if (inv.issueDate) {
        const issueDate = new Date(inv.issueDate);
        const daysPending = Math.floor((today.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysPending += daysPending;
      }
    });
    const avgDaysPending = pendingInvoices.length > 0 
      ? Math.round(totalDaysPending / pendingInvoices.length) 
      : 0;
    
    // Cobradas
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const paidAmount = paidInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const successRate = invoices.length > 0 
      ? Math.round((paidInvoices.length / invoices.length) * 100) 
      : 0;
    
    // Vencidas
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    
    // Calculate month-over-month trend (simplified)
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const thisMonthInvoices = invoices.filter(inv => {
      if (!inv.issueDate) return false;
      const date = new Date(inv.issueDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const lastMonthInvoices = invoices.filter(inv => {
      if (!inv.issueDate) return false;
      const date = new Date(inv.issueDate);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });
    
    const thisMonthTotal = thisMonthInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    
    const trendPercent = lastMonthTotal > 0 
      ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
      : 0;
    
    return {
      totalInvoiced,
      pendingAmount,
      avgDaysPending,
      paidAmount,
      successRate,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      trendPercent,
      totalCount: invoices.length
    };
  }, [invoices]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon={FileText}
        title="Total Facturado"
        value={formatCurrency(metrics.totalInvoiced)}
        description={`${metrics.totalCount} facturas`}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-50"
        trend={metrics.trendPercent !== 0 ? {
          value: metrics.trendPercent,
          isPositive: metrics.trendPercent > 0
        } : undefined}
        showSensitiveData={showSensitiveData}
      />
      <MetricCard
        icon={Clock}
        title="Por Cobrar"
        value={formatCurrency(metrics.pendingAmount)}
        description={`~${metrics.avgDaysPending} días promedio`}
        iconColor="text-amber-600"
        iconBgColor="bg-amber-50"
        showSensitiveData={showSensitiveData}
      />
      <MetricCard
        icon={CheckCircle}
        title="Cobrado"
        value={formatCurrency(metrics.paidAmount)}
        description={`${metrics.successRate}% tasa de cobro`}
        iconColor="text-green-600"
        iconBgColor="bg-green-50"
        showSensitiveData={showSensitiveData}
      />
      <MetricCard
        icon={AlertTriangle}
        title="Vencidas"
        value={formatCurrency(metrics.overdueAmount)}
        description={`${metrics.overdueCount} factura${metrics.overdueCount !== 1 ? 's' : ''} vencida${metrics.overdueCount !== 1 ? 's' : ''}`}
        iconColor="text-red-600"
        iconBgColor="bg-red-50"
        showSensitiveData={showSensitiveData}
      />
    </div>
  );
};

export default InvoicesMetricsCards;
