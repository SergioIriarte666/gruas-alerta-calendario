import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Fuel, CreditCard, Truck, Save, MapPin } from 'lucide-react';
import { type TripCalculationResult } from '@/hooks/useTripCalculation';
import { getFuelTypeLabel } from '@/hooks/useFuelPrices';
import { useAddTripEstimate } from '@/hooks/useTripEstimates';
import { toast } from 'sonner';

interface TripCostBreakdownProps {
  result: TripCalculationResult;
  originName: string;
  destinationName: string;
  craneType: string;
  vehicleConfig: '1_vehicle' | '2_vehicles';
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

export const TripCostBreakdown = ({
  result,
  originName,
  destinationName,
  craneType,
  vehicleConfig,
}: TripCostBreakdownProps) => {
  const { mutate: saveEstimate, isPending: isSaving } = useAddTripEstimate();

  const fuelPercent = result.total_estimate > 0
    ? Math.round((result.fuel.total_cost / result.total_estimate) * 100)
    : 0;
  const tollPercent = result.total_estimate > 0
    ? Math.round((result.tolls.total_cost / result.total_estimate) * 100)
    : 0;

  const handleSave = () => {
    saveEstimate(
      {
        origin: originName,
        destination: destinationName,
        route_name: `${originName.split(',')[0]} → ${destinationName.split(',')[0]}`,
        distance_km: result.distance_km,
        estimated_time_hours: result.estimated_time_hours,
        crane_type: craneType,
        vehicle_config: vehicleConfig,
        fuel_cost: result.fuel.total_cost,
        toll_cost: result.tolls.total_cost,
        additional_costs: result.additional_costs,
        total_estimate: result.total_estimate,
        calculation_details: result as any,
        service_id: null,
      },
      {
        onSuccess: () => toast.success('Estimación guardada'),
        onError: () => toast.error('Error al guardar'),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Route summary */}
      <Card className="border-border">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium text-foreground">{originName.split(',')[0]}</span>
            <span>→</span>
            <MapPin className="h-4 w-4 text-red-600" />
            <span className="font-medium text-foreground">{destinationName.split(',')[0]}</span>
          </div>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>{result.distance_km} km</span>
            <span>~{result.estimated_time_hours} hrs</span>
            <Badge variant="outline">{craneType}</Badge>
            <Badge variant="outline">
              {vehicleConfig === '2_vehicles' ? '2 Vehículos' : '1 Vehículo'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fuel card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fuel className="h-4 w-4 text-amber-600" />
              Combustible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(result.fuel.total_cost)}</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>{result.fuel.liters} litros × {formatCurrency(result.fuel.price_per_liter)}/L</p>
              <p>{getFuelTypeLabel(result.fuel.fuel_type)} • Consumo: {result.fuel.consumption_rate} L/km × {result.fuel.factor_used}</p>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>% del total</span>
                <span>{fuelPercent}%</span>
              </div>
              <Progress value={fuelPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Tolls card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              Peajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(result.tolls.total_cost)}</p>
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              {result.tolls.is_manual ? (
                <Badge variant="outline" className="text-xs">Ingreso manual</Badge>
              ) : result.tolls.details?.length ? (
                <>
                  <Badge variant="outline" className="text-xs mb-1">Cálculo automático</Badge>
                  {result.tolls.details.map((t, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate mr-2">{t.name}</span>
                      <span className="font-medium shrink-0">{formatCurrency(t.cost)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <Badge variant="outline" className="text-xs">Sin peajes</Badge>
              )}
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>% del total</span>
                <span>{tollPercent}%</span>
              </div>
              <Progress value={tollPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Additional costs card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-purple-600" />
              Costos Adicionales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(result.additional_costs)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Viáticos, desgaste y otros</p>
          </CardContent>
        </Card>
      </div>

      {/* Total */}
      <Card className="border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">TOTAL ESTIMADO</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(result.total_estimate)}
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar Estimación'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
