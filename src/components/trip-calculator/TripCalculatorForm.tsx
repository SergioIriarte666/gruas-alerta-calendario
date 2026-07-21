import React, { useMemo, useState } from 'react';
import { type ReturnTripConfig } from '@/hooks/useTripCalculation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useConsumptionRates } from '@/hooks/useConsumptionRates';
import { useCranes } from '@/hooks/useCranes';
import { useTripCalculation, type TripCalculationInput } from '@/hooks/useTripCalculation';
import { useTollCalculationV3 } from '@/hooks/useTollCalculationV3';
import { TripCostBreakdown } from './TripCostBreakdown';
import { TollBreakdownCard } from './TollBreakdownCard';
import { TripRouteMap } from './TripRouteMap';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { createLogger } from '@/lib/logger';
import { fetchRouteDirections } from '@/lib/routeDirections';
import {
  LocationAutocomplete,
  type SelectedLocation,
} from './LocationAutocomplete';

const logger = createLogger('TripCalculatorForm');

export const TripCalculatorForm = () => {
  const [originName, setOriginName] = useState('');
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destName, setDestName] = useState('');
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [selectedCraneId, setSelectedCraneId] = useState('');
  const [twoVehicles, setTwoVehicles] = useState(false);
  const [returnConfig, setReturnConfig] = useState<ReturnTripConfig>('empty');
  const [manualToll, setManualToll] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState('');

  useConsumptionRates();
  const { cranes } = useCranes();
  const { calculate, result, error, isCalculating, reset } = useTripCalculation();
  const {
    calculate: calculateTollV3,
    result: tollV3Result,
    isCalculating: tollV3Loading,
    requiresManualEntry,
    reset: resetTollV3,
  } = useTollCalculationV3();
  const { locations: savedLocations } = useSavedLocations();

  const activeCranes = cranes.filter((c) => c.isActive);
  const selectedCrane = activeCranes.find((c) => c.id === selectedCraneId);
  const craneType = selectedCrane?.type || '';

  const handleOriginChange = (text: string) => {
    setOriginName(text);
    const saved = savedLocations.find(
      (location) =>
        location.name === text &&
        location.latitude != null &&
        location.longitude != null,
    );
    if (saved?.latitude != null && saved.longitude != null) {
      setOriginCoords([saved.longitude, saved.latitude]);
    } else {
      setOriginCoords(null);
    }
    reset();
    resetTollV3();
  };

  const handleOriginPlaceSelected = (location: SelectedLocation) => {
    setOriginName(location.name);
    setOriginCoords([location.longitude, location.latitude]);
    reset();
    resetTollV3();
  };

  const handleDestChange = (text: string) => {
    setDestName(text);
    const saved = savedLocations.find(
      (location) =>
        location.name === text &&
        location.latitude != null &&
        location.longitude != null,
    );
    if (saved?.latitude != null && saved.longitude != null) {
      setDestCoords([saved.longitude, saved.latitude]);
    } else {
      setDestCoords(null);
    }
    reset();
    resetTollV3();
  };

  const handleDestPlaceSelected = (location: SelectedLocation) => {
    setDestName(location.name);
    setDestCoords([location.longitude, location.latitude]);
    reset();
    resetTollV3();
  };

  const showManualToll = useMemo(
    () => requiresManualEntry && !tollV3Result,
    [requiresManualEntry, tollV3Result],
  );

  const handleCalculate = async () => {
    if (!originCoords || !destCoords || !craneType) return;

    try {
      const craneCategory = selectedCrane?.tollVehicleCategory || 'LIVIANO';
      const route = await fetchRouteDirections(originCoords, destCoords);

      logger.debug('Toll lookup V3:', { originName, destName, craneCategory, twoVehicles });

      const tollV3 = await calculateTollV3({
        routeGeometry: route.geometry,
        craneCategory,
        twoVehicles,
        returnConfig,
      });

      const tollCost = tollV3?.totalCost ?? (manualToll ? Number(manualToll) : 0);
      const tollData = tollV3
        ? {
            total_cost: tollV3.totalCost,
            tolls: tollV3.breakdown.map((item) => ({
              name: item.name,
              cost: item.amount,
              highway: item.highway,
            })),
          }
        : null;

      const input: TripCalculationInput = {
        originCoords,
        destinationCoords: destCoords,
        originName,
        destinationName: destName,
        prefetchedRoute: route,
        craneType,
        crane: selectedCrane,
        vehicleConfig: twoVehicles ? '2_vehicles' : '1_vehicle',
        returnConfig,
        manualTollCost: tollCost,
        tollCostAlreadyRoundTrip: Boolean(tollV3),
        tollDetails: tollData?.tolls,
        additionalCosts: additionalCosts ? Number(additionalCosts) : 0,
        tollWasManual: false,
      };

      await calculate(input);
    } catch (routeError) {
      logger.error('No se pudo preparar la ruta para el calculo del viaje', routeError);
    }
  };

  const handleRecalculateWithManualToll = async () => {
    if (!originCoords || !destCoords || !craneType) return;

    try {
      resetTollV3();
      const route = await fetchRouteDirections(originCoords, destCoords);

      const input: TripCalculationInput = {
        originCoords,
        destinationCoords: destCoords,
        originName,
        destinationName: destName,
        prefetchedRoute: route,
        craneType,
        crane: selectedCrane,
        vehicleConfig: twoVehicles ? '2_vehicles' : '1_vehicle',
        returnConfig,
        manualTollCost: manualToll ? Number(manualToll) : 0,
        tollCostAlreadyRoundTrip: false,
        additionalCosts: additionalCosts ? Number(additionalCosts) : 0,
        tollWasManual: true,
      };

      await calculate(input);
    } catch (routeError) {
      logger.error('No se pudo recalcular la ruta con peaje manual', routeError);
    }
  };

  const canCalculate = originCoords && destCoords && craneType;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del Viaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationAutocomplete
              label="Origen"
              value={originName}
              onValueChange={handleOriginChange}
              onSelect={handleOriginPlaceSelected}
              placeholder="Buscar ciudad o dirección..."
            />
            <LocationAutocomplete
              label="Destino"
              value={destName}
              onValueChange={handleDestChange}
              onSelect={handleDestPlaceSelected}
              placeholder="Buscar ciudad o dirección..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Grúa</Label>
              <Select
                value={selectedCraneId}
                onValueChange={(v) => {
                  setSelectedCraneId(v);
                  reset();
                  resetTollV3();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar grúa..." />
                </SelectTrigger>
                <SelectContent>
                  {activeCranes.map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.licensePlate} — {crane.brand} {crane.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Costos Adicionales (CLP)</Label>
              <Input
                type="number"
                placeholder="Viáticos, desgaste..."
                value={additionalCosts}
                onChange={(e) => setAdditionalCosts(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={twoVehicles}
              onCheckedChange={(v) => {
                setTwoVehicles(v);
                reset();
                resetTollV3();
              }}
            />
            <Label className="cursor-pointer">
              {twoVehicles ? '2 Vehículos (grúa + arrastre)' : '1 Vehículo (solo grúa cargada)'}
            </Label>
          </div>

          <div>
            <Label className="mb-1.5 block">Configuración de Vuelta</Label>
            <Select
              value={returnConfig}
              onValueChange={(v) => {
                setReturnConfig(v as ReturnTripConfig);
                reset();
                resetTollV3();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">Vacía (sin carga)</SelectItem>
                <SelectItem value="1_vehicle">Cargada (1 vehículo)</SelectItem>
                <SelectItem value="2_vehicles">Con arrastre (2 vehículos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate || isCalculating || tollV3Loading}
            className="w-full bg-primary px-8 font-semibold text-primary-foreground hover:bg-primary/90 md:w-auto"
            size="lg"
          >
            {isCalculating || tollV3Loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              'Calcular Viaje'
            )}
          </Button>

          {/* Manual toll fallback — shown when automatic calculation fails */}
          {showManualToll && (
            <div className="space-y-3 rounded-lg border border-warning/40 bg-warning-soft p-4">
              <p className="text-sm text-warning-text">
                ⚠️ No se pudieron calcular los peajes automáticamente. Puede ingresar el monto manualmente:
              </p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="mb-1.5 block text-sm">Peajes Manual (CLP)</Label>
                  <Input
                    type="number"
                    placeholder="Ingrese monto de peajes..."
                    value={manualToll}
                    onChange={(e) => setManualToll(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleRecalculateWithManualToll}
                  disabled={isCalculating}
                  variant="outline"
                  className="shrink-0"
                >
                  Recalcular
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {result.routeGeometry && result.originCoords && result.destinationCoords && (
            <TripRouteMap
              geometry={result.routeGeometry}
              originCoords={result.originCoords}
              destinationCoords={result.destinationCoords}
              originName={originName}
              destinationName={destName}
              distanceKm={result.distance_km}
              estimatedTimeHours={result.estimated_time_hours}
            />
          )}
          {tollV3Result && (
            <TollBreakdownCard result={tollV3Result} />
          )}
          <TripCostBreakdown
            result={result}
            originName={originName}
            destinationName={destName}
            craneType={craneType}
            vehicleConfig={twoVehicles ? '2_vehicles' : '1_vehicle'}
          />
        </>
      )}
    </div>
  );
};
