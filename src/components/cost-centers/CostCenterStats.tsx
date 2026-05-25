import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { CostCenterWithStats } from '@/types/costCenters';

interface CostCenterStatsProps {
  costCenters: CostCenterWithStats[];
}

export const CostCenterStats = ({ costCenters }: CostCenterStatsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const totalBudget = costCenters.reduce((sum, center) => sum + Number(center.budget_amount || 0), 0);
  const totalSpent = costCenters.reduce((sum, center) => sum + center.total_costs, 0);
  const budgetUsagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  
  const overBudgetCenters = costCenters.filter(center => 
    center.budget_amount > 0 && center.budget_used_percentage > 100
  );

  const activeCenters = costCenters.filter(center => center.is_active);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Centros Activos</CardTitle>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCenters.length}</div>
          <p className="text-xs text-muted-foreground">
            de {costCenters.length} totales
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
          <p className="text-xs text-muted-foreground">
            Gastado: {formatCurrency(totalSpent)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Uso del Presupuesto</CardTitle>
          {budgetUsagePercentage > 100 ? 
            <TrendingDown className="size-4 text-destructive" /> :
            <TrendingUp className="size-4 text-success" />
          }
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {budgetUsagePercentage.toFixed(1)}%
          </div>
          <Progress 
            value={Math.min(budgetUsagePercentage, 100)} 
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sobre Presupuesto</CardTitle>
          <AlertTriangle className="size-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {overBudgetCenters.length}
          </div>
          <p className="text-xs text-muted-foreground">
            centros excedidos
          </p>
        </CardContent>
      </Card>
    </div>
  );
};