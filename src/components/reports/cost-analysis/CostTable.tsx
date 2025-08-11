import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CostMetrics } from '@/hooks/reports/useCostMetrics';

interface CostTableProps {
  metrics: CostMetrics;
}

export const CostTable = ({ metrics }: CostTableProps) => {
  if (!metrics.costsByCategory || metrics.costsByCategory.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/10 border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Detalle de Costos por Categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left text-white font-medium p-3">Categoría</th>
                <th className="text-right text-white font-medium p-3">Total</th>
                <th className="text-right text-white font-medium p-3">Porcentaje</th>
                <th className="text-right text-white font-medium p-3">Promedio por Servicio</th>
              </tr>
            </thead>
            <tbody>
              {metrics.costsByCategory.map((category) => (
                <tr key={category.categoryId} className="border-b border-white/10 hover:bg-white/5">
                  <td className="text-white p-3">{category.categoryName}</td>
                  <td className="text-right text-green-400 p-3 font-medium">
                    ${category.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right text-blue-400 p-3">
                    {category.percentage.toFixed(1)}%
                  </td>
                  <td className="text-right text-purple-400 p-3">
                    ${metrics.totalServices > 0 ? (category.total / metrics.totalServices).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};