import { useMemo } from 'react';
import { IncomeWithDetails } from '@/types/incomes';
import { DollarSign, Hash, TrendingUp, CreditCard } from 'lucide-react';
import { getIconComponent } from '@/utils/iconMapper';

interface IncomesPipelineMetricsProps {
  incomes: IncomeWithDetails[];
}

export const IncomesPipelineMetrics = ({ incomes }: IncomesPipelineMetricsProps) => {
  const metrics = useMemo(() => {
    const totalAmount = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalCount = incomes.length;
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    // Método de pago más usado
    const paymentMethodCounts = incomes.reduce((acc, income) => {
      acc[income.payment_method] = (acc[income.payment_method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedMethod = Object.entries(paymentMethodCounts).sort(([,a], [,b]) => b - a)[0];
    const methodLabels: Record<string, string> = {
      transferencia: 'Transferencia',
      efectivo: 'Efectivo',
      cheque: 'Cheque',
      deposito: 'Depósito',
      tarjeta_credito: 'T. Crédito',
      tarjeta_debito: 'T. Débito',
      otro: 'Otro',
    };

    // Agrupar por categoría
    const byCategory = incomes.reduce((acc, income) => {
      const categoryId = income.category_id || 'uncategorized';
      const categoryName = income.category?.name || 'Sin Categoría';
      const categoryColor = income.category?.color || '#9ca3af';
      const categoryIcon = income.category?.icon || 'dollar-sign';

      if (!acc[categoryId]) {
        acc[categoryId] = {
          name: categoryName,
          color: categoryColor,
          icon: categoryIcon,
          count: 0,
          amount: 0,
        };
      }
      acc[categoryId].count++;
      acc[categoryId].amount += income.amount;
      return acc;
    }, {} as Record<string, { name: string; color: string; icon: string; count: number; amount: number }>);

    return {
      totalAmount,
      totalCount,
      avgAmount,
      mostUsedMethod: mostUsedMethod ? methodLabels[mostUsedMethod[0]] : 'N/A',
      byCategory: Object.entries(byCategory).map(([id, data]) => ({
        id,
        ...data,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      })),
    };
  }, [incomes]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Ingresos</span>
            <DollarSign className="h-5 w-5 text-green-400" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-green-400">
              ${metrics.totalAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">{metrics.totalCount} registros</p>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Cantidad</span>
            <Hash className="h-5 w-5 text-blue-400" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-blue-400">{metrics.totalCount}</p>
            <p className="text-xs text-muted-foreground">Total de ingresos</p>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Promedio</span>
            <TrendingUp className="h-5 w-5 text-purple-400" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-purple-400">
              ${metrics.avgAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">Por ingreso</p>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Método Popular</span>
            <CreditCard className="h-5 w-5 text-orange-400" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-orange-400">{metrics.mostUsedMethod}</p>
            <p className="text-xs text-muted-foreground">Más usado</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Desglose por Categoría</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metrics.byCategory.map((category) => {
            const IconComponent = getIconComponent(category.icon);
            return (
              <div
                key={category.id}
                className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: category.color,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        backgroundColor: `${category.color}20`,
                      }}
                    >
                      <IconComponent
                        className="h-4 w-4"
                        style={{ color: category.color }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground">{category.name}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold" style={{ color: category.color }}>
                      ${category.amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{category.count} registros</span>
                    <span>{category.percentage.toFixed(1)}% del total</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
