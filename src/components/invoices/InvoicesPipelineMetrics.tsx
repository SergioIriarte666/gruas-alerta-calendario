import { businessClock } from '@/utils/businessClock';
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, DollarSign, FileText, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Invoice } from '@/types';

interface InvoicesPipelineMetricsProps {
  invoices: Invoice[];
}

export const InvoicesPipelineMetrics: React.FC<InvoicesPipelineMetricsProps> = ({ invoices }) => {
  const metrics = useMemo(() => {
    const now = businessClock.now();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Group invoices by status
    const byStatus = {
      draft: invoices.filter(i => i.status === 'draft'),
      sent: invoices.filter(i => i.status === 'sent'),
      paid: invoices.filter(i => i.status === 'paid'),
      overdue: invoices.filter(i => i.status === 'overdue'),
      cancelled: invoices.filter(i => i.status === 'cancelled')
    };

    // Calculate totals
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidAmount = byStatus.paid.reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = totalAmount - paidAmount;

    // Calculate urgent invoices (due in 3 days or less)
    const urgentInvoices = invoices.filter(inv => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      const dueDate = new Date(inv.dueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    });

    // Calculate average payment time for paid invoices
    const paidInvoicesWithPaymentDate = byStatus.paid.filter(inv => inv.paymentDate);
    const avgPaymentTime = paidInvoicesWithPaymentDate.length > 0 
      ? paidInvoicesWithPaymentDate.reduce((sum, inv) => {
          const issueDate = new Date(inv.issueDate);
          const paymentDate = new Date(inv.paymentDate!);
          const diffTime = paymentDate.getTime() - issueDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }, 0) / paidInvoicesWithPaymentDate.length
      : 0;

    return {
      totalInvoices,
      totalAmount,
      paidAmount,
      pendingAmount,
      avgPaymentTime: Math.round(avgPaymentTime),
      urgentCount: urgentInvoices.length,
      byStatus: {
        draft: { count: byStatus.draft.length, amount: byStatus.draft.reduce((sum, inv) => sum + inv.total, 0) },
        sent: { count: byStatus.sent.length, amount: byStatus.sent.reduce((sum, inv) => sum + inv.total, 0) },
        paid: { count: byStatus.paid.length, amount: byStatus.paid.reduce((sum, inv) => sum + inv.total, 0) },
        overdue: { count: byStatus.overdue.length, amount: byStatus.overdue.reduce((sum, inv) => sum + inv.total, 0) },
        cancelled: { count: byStatus.cancelled.length, amount: byStatus.cancelled.reduce((sum, inv) => sum + inv.total, 0) }
      }
    };
  }, [invoices]);

  const overviewCards = [
    {
      title: "Total Facturas",
      value: metrics.totalInvoices,
      subtitle: `$${metrics.totalAmount.toLocaleString('es-CL')}`,
      icon: FileText,
      color: "text-info",
      bgColor: "bg-info/10"
    },
    {
      title: "Monto Cobrado",
      value: `$${metrics.paidAmount.toLocaleString('es-CL')}`,
      subtitle: `${metrics.byStatus.paid.count} facturas`,
      icon: CreditCard,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      title: "Monto Pendiente",
      value: `$${metrics.pendingAmount.toLocaleString('es-CL')}`,
      subtitle: `${metrics.totalInvoices - metrics.byStatus.paid.count - metrics.byStatus.cancelled.count} facturas`,
      icon: DollarSign,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      title: "Tiempo Promedio Pago",
      value: `${metrics.avgPaymentTime} días`,
      subtitle: "Promedio histórico",
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10"
    }
  ];

  const statusCards = [
    {
      title: "Borradores",
      count: metrics.byStatus.draft.count,
      amount: metrics.byStatus.draft.amount,
      color: "text-muted-foreground",
      bgColor: "bg-muted/40",
      description: "En preparación"
    },
    {
      title: "Enviadas",
      count: metrics.byStatus.sent.count,
      amount: metrics.byStatus.sent.amount,
      color: "text-info",
      bgColor: "bg-info/10",
      description: "Pendientes de pago"
    },
    {
      title: "Pagadas",
      count: metrics.byStatus.paid.count,
      amount: metrics.byStatus.paid.amount,
      color: "text-success",
      bgColor: "bg-success/10",
      description: "Cobradas exitosamente"
    },
    {
      title: "Vencidas",
      count: metrics.byStatus.overdue.count,
      amount: metrics.byStatus.overdue.amount,
      color: "text-danger",
      bgColor: "bg-danger/10",
      description: "Requieren atención",
      urgent: metrics.byStatus.overdue.count > 0
    },
    {
      title: "Anuladas",
      count: metrics.byStatus.cancelled.count,
      amount: metrics.byStatus.cancelled.amount,
      color: "text-muted-foreground",
      bgColor: "bg-muted/40",
      description: "Canceladas"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Resumen General del Pipeline</h3>
            {metrics.urgentCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-x-1">
                <AlertTriangle className="size-3" />
                <span>{metrics.urgentCount} Urgentes</span>
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {overviewCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg",
                    card.bgColor
                  )}
                >
                  <div className={cn("p-2 rounded-lg bg-muted", card.bgColor)}>
                    <Icon className={cn("size-5", card.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-lg font-bold text-foreground truncate">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statusCards.map((card, index) => (
          <Card
            key={index}
            className={cn(
              "bg-card border-border transition-all duration-200 hover:bg-muted",
              card.urgent && "ring-2 ring-danger/20 animate-pulse"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-foreground">{card.title}</h4>
                {card.urgent && <AlertTriangle className="size-4 text-danger" />}
              </div>
              
              <div className="space-y-1">
                <p className={cn("text-2xl font-bold", card.color)}>{card.count}</p>
                <p className="text-sm text-foreground">${card.amount.toLocaleString('es-CL')}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
