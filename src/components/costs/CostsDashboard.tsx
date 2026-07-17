import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, FileText, BarChart3, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Cost } from '@/types/costs';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';

interface CostsDashboardProps {
  costs: Cost[];
  dateFilter: string;
  allCosts: Cost[];
}

interface CategoryBreakdown {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

export const CostsDashboard = ({ costs, dateFilter, allCosts }: CostsDashboardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return formatCurrency(amount);
  };

  // Métricas calculadas
  const metrics = useMemo(() => {
    const today = businessClock.todayDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Costos filtrados actuales
    const totalFiltered = costs.reduce((sum, c) => sum + Number(c.amount), 0);
    const countFiltered = costs.length;
    const avgFiltered = countFiltered > 0 ? totalFiltered / countFiltered : 0;

    // Costos del mes actual (de todos los costos)
    const currentMonthCosts = allCosts.filter(c => {
      const d = new Date(`${c.date}T12:00:00Z`);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const currentMonthTotal = currentMonthCosts.reduce((sum, c) => sum + Number(c.amount), 0);

    // Costos del mes anterior
    const lastMonthCosts = allCosts.filter(c => {
      const d = new Date(`${c.date}T12:00:00Z`);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const lastMonthTotal = lastMonthCosts.reduce((sum, c) => sum + Number(c.amount), 0);

    // Variación mensual
    const monthVariation = lastMonthTotal > 0
      ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0;

    // Costos de hoy
    const todayCosts = allCosts.filter(c => {
      const d = new Date(`${c.date}T12:00:00Z`);
      return d.toDateString() === today.toDateString();
    });
    const todayTotal = todayCosts.reduce((sum, c) => sum + Number(c.amount), 0);

    return {
      totalFiltered,
      countFiltered,
      avgFiltered,
      currentMonthTotal,
      lastMonthTotal,
      monthVariation,
      todayTotal,
      todayCount: todayCosts.length,
    };
  }, [costs, allCosts]);

  // Desglose por categorías
  const categoryBreakdown = useMemo((): CategoryBreakdown[] => {
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();

    costs.forEach(cost => {
      const catName = cost.cost_categories?.name || 'Sin categoría';
      const existing = categoryMap.get(catName);
      if (existing) {
        existing.amount += Number(cost.amount);
        existing.count += 1;
      } else {
        categoryMap.set(catName, { name: catName, amount: Number(cost.amount), count: 1 });
      }
    });

    const total = metrics.totalFiltered || 1;
    const breakdown = Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        percentage: (cat.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Top 5

    return breakdown;
  }, [costs, metrics.totalFiltered]);

  const getPeriodLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mes';
      default: return 'Todos los períodos';
    }
  };

  return (
    <div className="space-y-4">
      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total filtrado */}
        <Card className="dashboard-kpi dashboard-kpi--primary" data-tone="primary">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Total {getPeriodLabel()}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(metrics.totalFiltered)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.countFiltered} registros
                </p>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl">
                <DollarSign className="size-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Promedio */}
        <Card className="dashboard-kpi" data-tone="info">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Promedio</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(metrics.avgFiltered)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  por costo
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                <BarChart3 className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Este mes */}
        <Card className="dashboard-kpi" data-tone="warning">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Este Mes</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(metrics.currentMonthTotal)}
                </p>
                {metrics.monthVariation !== 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {metrics.monthVariation > 0 ? (
                      <TrendingUp className="size-3 text-red-500" />
                    ) : (
                      <TrendingDown className="size-3 text-green-500" />
                    )}
                    <span className={cn(
                      'text-xs font-medium',
                      metrics.monthVariation > 0 ? 'text-red-500' : 'text-green-500'
                    )}>
                      {Math.abs(metrics.monthVariation).toFixed(1)}% vs mes ant.
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
                <FileText className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hoy */}
        <Card className="dashboard-kpi" data-tone="success">
          <span className="dashboard-kpi__accent" aria-hidden="true" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Hoy</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCompactCurrency(metrics.todayTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.todayCount} registros
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                <DollarSign className="size-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por categorías */}
      {categoryBreakdown.length > 0 && (
        <Card className="finance-panel">
          <Collapsible defaultOpen={false}>
            <CardContent className="p-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Top Categorías ({getPeriodLabel()})
                </h3>
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-3">
                  {categoryBreakdown.map((cat, _index) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium truncate max-w-[200px]">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            {cat.percentage.toFixed(1)}%
                          </span>
                          <span className="font-medium text-foreground min-w-[80px] text-right">
                            {formatCompactCurrency(cat.amount)}
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={cat.percentage}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </CardContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
};
