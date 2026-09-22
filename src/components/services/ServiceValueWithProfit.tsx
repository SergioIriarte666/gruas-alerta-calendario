import { Service } from '@/types';
import { formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue, getServiceValueForProfit } from '@/utils/serviceValueCalculations';

interface ServiceValueWithProfitProps {
  service: Service;
  totalCost?: number;
  isError?: boolean;
}

export const ServiceValueWithProfit = ({ service, totalCost, isError }: ServiceValueWithProfitProps) => {
  const profit = totalCost === undefined ? undefined : getServiceValueForProfit(service) - totalCost;

  return (
    <div className="space-y-1 whitespace-nowrap tabular-nums">
      <div className="font-medium">{formatCurrency(getDisplayServiceValue(service))}</div>
      <div
        className={`text-xs font-normal ${isError || profit === undefined || profit === 0 ? 'text-muted-foreground' : profit < 0 ? 'text-destructive' : 'text-success'}`}
        title="Valor del servicio menos costos registrados, incluidas las comisiones registradas como costo"
      >
        {isError ? 'Utilidad no disponible' : profit === undefined ? 'Calculando utilidad…' : `Utilidad: ${formatCurrency(profit)}`}
      </div>
    </div>
  );
};
