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
import { useTollCalculationV2 } from '@/hooks/useTollCalculationV2';
import { TripCostBreakdown } from './TripCostBreakdown';
import { TollBreakdownCard } from './TollBreakdownCard';
import { TripRouteMap } from './TripRouteMap';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { createLogger } from '@/lib/logger';
import { fetchRouteDirections } from '@/lib/routeDirections';
import { AddressAutocomplete, type PlaceResult } from '@/components/shared/AddressAutocomplete';

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
    calculate: calculateTollV2,
    result: tollV2Result,
    isCalculating: tollV2Loading,
    requiresManualEntry,
    reset: resetTollV2,
  } = useTollCalculationV2();
  const { locations: savedLocations } = useSavedLocations();

  const activeCranes = cranes.filter((c) => c.isActive);
  const selectedCrane = activeCranes.find((c) => c.id === selectedCraneId);
  const craneType = selectedCrane?.type || '';

  const savedNames = savedLocations.map((l) => l.name);

  const showManualToll = useMemo(
    () => requiresManualEntry && !tollV2Result,
    [requiresManualEntry, tollV2Result],
  );

  const handleOriginChange = (text: string) => {
    setOriginName(text);
    // Match against saved locations for instant coord resolution
    const saved = savedLocations.find((l) => l.name === text);
    if (saved) {
      setOriginCoords([saved.longitude, saved.latitude]);
    } else {
      setOriginCoords(null);
    }
    reset();
    resetTollV2();
  };

  const handleOriginPlaceSelected = (place: PlaceResult) => {
    setOriginName(place.formattedAddress);
    setOriginCoords([place.lng, place.lat]); // [lng, lat] — GeoJSON / Mapbox convention
    reset();
    resetTollV2();
  };

  const handleDestChange = (text: string) => {
    setDestName(text);
    const saved = savedLocations.find((l) => l.name === text);
    if (saved) {
      setDestCoords([saved.longitude, saved.latitude]);
    } else {
      setDestCoords(null);
    }
    reset();
    resetTollV2();
  };

  const handleDestPlaceSelected = (place: PlaceResult) => {
    setDestName(place.formattedAddress);
    setDestCoords([place.lng, place.lat]);
    reset();
    resetTollV2();
  };

  const handleCalculate = async () => {
    if (!originCoords || !destCoords || !craneType) return;

    try {
      const craneCategory = selectedCrane?.tollVehicleCategory || 'LIVIANO';
      const route = await fetchRouteDirections(originCoords, destCoords);

      logger.debug('Toll lookup V2:', { originName, destName, craneCategory, twoVehicles });

      const tollV2 = await calculateTollV2({
        originName,
        destName,
        originCoords,
        destCoords,
        routeGeometry: route.geometry,
        craneCategory,
        twoVehicles,
        returnConfig,
      });

      const tollCost = tollV2?.totalCost ?? (manualToll ? Number(manualToll) : 0);
      const tollData = tollV2
        ? {
            total_cost: tollV2.totalCost,
            tolls: tollV2.breakdown.map((item) => ({
              name: item.stationName,
              cost: item.rateAmount,
              highway: item.highway ?? undefined,
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
        tollCostAlreadyRoundTrip: Boolean(tollV2),
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
      resetTollV2();
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
            <AddressAutocomplete
              label="Origen"
              value={originName}
              onChange={handleOriginChange}
              onPlaceSelected={handleOriginPlaceSelected}
              historySuggestions={savedNames}
              placeholder="Buscar ciudad o dirección..."
            />
            <AddressAutocomplete
              label="Destino"
              value={destName}
              onChange={handleDestChange}
              onPlaceSelected={handleDestPlaceSelected}
              historySuggestions={savedNames}
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
                  resetTollV2();
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
                resetTollV2();
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
                resetTollV2();
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
            disabled={!canCalculate || isCalculating || tollV2Loading}
            className="w-full md:w-auto bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8"
            size="lg"
          >
            {isCalculating || tollV2Loading ? (
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
            <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
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
          {tollV2Result && tollV2Result.totalCost > 0 && (
            <TollBreakdownCard result={tollV2Result} />
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
