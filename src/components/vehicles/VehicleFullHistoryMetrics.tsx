import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Receipt, ShoppingCart, DollarSign } from 'lucide-react';
import { VehicleFullHistorySummary } from '@/hooks/useVehicleFullHistory';
import { formatCurrency } from '@/utils/statusHelpers';

interface VehicleFullHistoryMetricsProps {
  summary: VehicleFullHistorySummary;
  showSensitiveData: boolean;
}

export const VehicleFullHistoryMetrics: React.FC<VehicleFullHistoryMetricsProps> = ({
  summary,
  showSensitiveData
}) => {
  const metrics = [
    {
      label: 'Total Servicios',
      value: summary.totalServices,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Servicios realizados'
    },
    {
      label: 'Con Cotización',
      value: summary.servicesWithQuote,
      icon: FileText,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      description: 'Servicios cotizados'
    },
    {
      label: 'Con OC',
      value: summary.servicesWithPO,
      icon: ShoppingCart,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      description: 'Con orden de compra'
    },
    {
      label: 'Facturados',
      value: summary.servicesWithInvoice,
      icon: Receipt,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Con factura emitida'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card 
            key={index} 
            className="border-border/50 hover:border-violet-300 hover:shadow-md transition-all duration-200"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {metric.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Card de valor total */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white hover:shadow-md transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <DollarSign className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-violet-700">
                {showSensitiveData ? formatCurrency(summary.totalValue) : '••••••'}
              </p>
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
