import { Service } from '@/types';
import { formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue, getServiceValueForProfit } from '@/utils/serviceValueCalculations';

interface ServiceValueWithProfitProps {
  service: Service;
  totalCost?: number;
  isError?: boolean;
  /**
   * Viaje multi-vehículo (padre): el padre lleva value 0 en BD; el valor
   * mostrado y la base de utilidad es la suma de los hijos (trip_value).
   */
  tripValue?: number;
  /** Hijo de un viaje: parte de los costos viene prorrateada desde el padre. */
  allocatedCost?: number;
}

export const ServiceValueWithProfit = ({ service, totalCost, isError, tripValue, allocatedCost }: ServiceValueWithProfitProps) => {
  const isTripParent = tripValue !== undefined;
  const displayValue = isTripParent ? tripValue : getDisplayServiceValue(service);
  const profitBase = isTripParent ? tripValue : getServiceValueForProfit(service);
  const profit = totalCost === undefined ? undefined : profitBase - totalCost;

  const costsTitle = isTripParent
    ? 'Costos del viaje registrados en el padre (se prorratean a cada vehículo)'
    : allocatedCost
      ? `Costos directos más ${formatCurrency(allocatedCost)} prorrateados desde el viaje`
      : 'Costos registrados del servicio, incluidas las comisiones registradas como costo';

  return (
    <div className="space-y-1 whitespace-nowrap tabular-nums">
      <div className="font-medium" title={isTripParent ? 'Suma de los valores de los vehículos del viaje' : undefined}>
        {formatCurrency(displayValue)}
      </div>
      <div className="text-xs font-normal text-muted-foreground" title={costsTitle}>
        {isError ? 'Costos no disponibles' : totalCost === undefined ? 'Cargando costos…' : `Costos: ${formatCurrency(totalCost)}`}
      </div>
      <div
        className={`text-xs font-normal ${isError || profit === undefined || profit === 0 ? 'text-muted-foreground' : profit < 0 ? 'text-destructive' : 'text-success'}`}
        title={isTripParent
          ? 'Valor del viaje (suma de vehículos) menos costos del viaje'
          : 'Valor del servicio menos costos registrados, incluidas las comisiones registradas como costo'}
      >
        {isError ? 'Utilidad no disponible' : profit === undefined ? 'Calculando utilidad…' : `Utilidad: ${formatCurrency(profit)}`}
      </div>
    </div>
  );
};
