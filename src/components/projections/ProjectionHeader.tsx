import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, AlertCircle, Clock, Percent } from "lucide-react";
import { ProjectionMetrics } from "@/hooks/projections/useIncomeProjections";

interface ProjectionHeaderProps {
  metrics: ProjectionMetrics;
  dateRange: number;
  isLoading?: boolean;
}

export const ProjectionHeader = ({ metrics, dateRange, isLoading }: ProjectionHeaderProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      title: "Total Proyectado",
      subtitle: `Próximos ${dateRange} días`,
      value: formatCurrency(metrics.totalProjectedInRange),
      icon: TrendingUp,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      title: "Facturas Vencidas",
      subtitle: "Monto por cobrar",
      value: formatCurrency(metrics.totalOverdue),
      icon: AlertCircle,
      colorClass: "text-danger",
      bgClass: "bg-danger/10",
    },
    {
      title: "En Proceso de Cobro",
      subtitle: "Enviadas y parciales",
      value: formatCurrency(metrics.totalInCollection),
      icon: Clock,
      colorClass: "text-warning",
      bgClass: "bg-warning/10",
    },
    {
      title: "Cobrado en Cartera Actual",
      subtitle: "% ya pagado sobre facturas abiertas",
      value: `${metrics.paidRateOpenPortfolio.toFixed(1)}%`,
      icon: Percent,
      colorClass: "text-info",
      bgClass: "bg-info/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className={`dashboard-kpi transition-colors ${index === 0 ? 'dashboard-kpi--primary' : ''}`} data-tone={index === 1 ? 'danger' : index === 2 ? 'warning' : index === 3 ? 'info' : 'primary'}>
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {card.subtitle}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgClass}`}>
                <card.icon className={`size-6 ${card.colorClass}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
