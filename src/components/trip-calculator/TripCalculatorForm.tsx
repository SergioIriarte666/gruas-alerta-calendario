import React, { useState, useCallback, useRef, useEffect } from 'react';
import { type ReturnTripConfig } from '@/hooks/useTripCalculation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useConsumptionRates } from '@/hooks/useConsumptionRates';
import { useCranes } from '@/hooks/useCranes';
import { useTripCalculation, type TripCalculationInput } from '@/hooks/useTripCalculation';
import { useTollCalculation, useTollLocations, matchTollLocation } from '@/hooks/useTollCalculation';
import { TripCostBreakdown } from './TripCostBreakdown';

interface GeoResult {
  name: string;
  coordinates: [number, number];
}

function useGeocode() {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((query: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
          body: { action: 'geocode', query },
        });
        if (!error && data?.results) setResults(data.results);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  return { results, loading, search, setResults };
}

interface LocationInputProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onSelect: (name: string, coords: [number, number]) => void;
}

const LocationInput = ({ label, icon, value, onSelect }: LocationInputProps) => {
  const { results, loading, search, setResults } = useGeocode();
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div className="relative">
      <Label className="flex items-center gap-2 mb-1.5">
        {icon}
        {label}
      </Label>
      <Input
        value={inputValue}
        placeholder="Buscar ciudad o dirección..."
        onChange={(e) => {
          setInputValue(e.target.value);
          search(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent truncate"
              onMouseDown={() => {
                onSelect(r.name, r.coordinates);
                setInputValue(r.name);
                setResults([]);
                setShowDropdown(false);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const TripCalculatorForm = () => {
  const [originName, setOriginName] = useState('');
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destName, setDestName] = useState('');
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [selectedCraneId, setSelectedCraneId] = useState('');
  const [twoVehicles, setTwoVehicles] = useState(false);
  const [returnConfig, setReturnConfig] = useState<ReturnTripConfig>('empty');
  const [manualToll, setManualToll] = useState('');
  const [showManualToll, setShowManualToll] = useState(false);
  const [additionalCosts, setAdditionalCosts] = useState('');

  const { data: rates = [] } = useConsumptionRates();
  const { cranes } = useCranes();
  const { calculate, result, error, isCalculating, reset } = useTripCalculation();
  const { calculateTolls, tollResult, tollError, isCalculating: tollLoading, resetTolls } = useTollCalculation();
  const { data: tollLocations = [] } = useTollLocations();

  const activeCranes = cranes.filter(c => c.isActive);
  const selectedCrane = activeCranes.find(c => c.id === selectedCraneId);
  const craneType = selectedCrane?.type || '';

  const handleCalculate = async () => {
    if (!originCoords || !destCoords || !craneType) return;

    setShowManualToll(false);

    // Try matching each comma-separated part of the address against valid toll locations
    const findBestTollMatch = (fullName: string): string => {
      const parts = fullName.split(',').map(p => p.trim()).filter(Boolean);
      // Try each part against toll locations, return first match
      for (const part of parts) {
        const match = matchTollLocation(part, tollLocations);
        if (match) return match;
      }
      // Fallback: return first part (city name guess)
      return parts[0] || fullName;
    };

    const originCity = findBestTollMatch(originName);
    const destCity = findBestTollMatch(destName);
    const tollCategory = selectedCrane?.tollVehicleCategory || 'LIVIANO';
    console.log('Toll lookup:', { originName, destName, matchedOrigin: originCity, matchedDest: destCity, tollCategory });
    const tollData = await calculateTolls(originCity, destCity, tollCategory);

    // If toll API failed, show manual fallback
    if (!tollData) {
      setShowManualToll(true);
    }

    const tollCost = tollData?.total_cost ?? (manualToll ? Number(manualToll) : 0);

    const input: TripCalculationInput = {
      originCoords,
      destinationCoords: destCoords,
      originName,
      destinationName: destName,
      craneType,
      vehicleConfig: twoVehicles ? '2_vehicles' : '1_vehicle',
      returnConfig,
      manualTollCost: tollCost,
      tollDetails: tollData?.tolls,
      additionalCosts: additionalCosts ? Number(additionalCosts) : 0,
    };

    await calculate(input);
  };

  const handleRecalculateWithManualToll = async () => {
    if (!originCoords || !destCoords || !craneType) return;

    const input: TripCalculationInput = {
      originCoords,
      destinationCoords: destCoords,
      originName,
      destinationName: destName,
      craneType,
      vehicleConfig: twoVehicles ? '2_vehicles' : '1_vehicle',
      returnConfig,
      manualTollCost: manualToll ? Number(manualToll) : 0,
      additionalCosts: additionalCosts ? Number(additionalCosts) : 0,
    };

    await calculate(input);
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
            <LocationInput
              label="Origen"
              icon={<MapPin className="h-4 w-4 text-green-600" />}
              value={originName}
              onSelect={(name, coords) => {
                setOriginName(name);
                setOriginCoords(coords);
                reset();
                resetTolls();
                setShowManualToll(false);
              }}
            />
            <LocationInput
              label="Destino"
              icon={<Navigation className="h-4 w-4 text-red-600" />}
              value={destName}
              onSelect={(name, coords) => {
                setDestName(name);
                setDestCoords(coords);
                reset();
                resetTolls();
                setShowManualToll(false);
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Grúa</Label>
              <Select value={selectedCraneId} onValueChange={(v) => { setSelectedCraneId(v); reset(); }}>
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
              onCheckedChange={(v) => { setTwoVehicles(v); reset(); }}
            />
            <Label className="cursor-pointer">
              {twoVehicles ? '2 Vehículos (grúa + arrastre)' : '1 Vehículo (solo grúa cargada)'}
            </Label>
          </div>

          <div>
            <Label className="mb-1.5 block">Configuración de Vuelta</Label>
            <Select value={returnConfig} onValueChange={(v) => { setReturnConfig(v as ReturnTripConfig); reset(); }}>
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
            disabled={!canCalculate || isCalculating || tollLoading}
            className="w-full md:w-auto bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8"
            size="lg"
          >
            {isCalculating || tollLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              'Calcular Viaje'
            )}
          </Button>

          {/* Manual toll fallback - only shown when API fails */}
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
        <TripCostBreakdown
          result={result}
          originName={originName}
          destinationName={destName}
          craneType={craneType}
          vehicleConfig={twoVehicles ? '2_vehicles' : '1_vehicle'}
        />
      )}
    </div>
  );
};
