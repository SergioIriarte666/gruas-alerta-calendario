import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentFuelPrices } from './useFuelPrices';
import { useConsumptionRates, type ConsumptionRate } from './useConsumptionRates';

export interface TripCalculationInput {
  originCoords: [number, number];
  destinationCoords: [number, number];
  originName: string;
  destinationName: string;
  craneType: string;
  vehicleConfig: '1_vehicle' | '2_vehicles';
  manualTollCost?: number;
  tollDetails?: Array<{ name: string; cost: number; highway?: string }>;
  additionalCosts?: number;
}

export interface TripCalculationResult {
  distance_km: number;
  estimated_time_hours: number;
  fuel: {
    liters: number;
    price_per_liter: number;
    fuel_type: string;
    total_cost: number;
    consumption_rate: number;
    factor_used: number;
  };
  tolls: {
    total_cost: number;
    is_manual: boolean;
    details?: Array<{ name: string; cost: number }>;
  };
  additional_costs: number;
  total_estimate: number;
}

export function useTripCalculation() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<TripCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: fuelPrices } = useCurrentFuelPrices();
  const { data: consumptionRates } = useConsumptionRates();

  const calculate = useCallback(
    async (input: TripCalculationInput) => {
      setIsCalculating(true);
      setError(null);
      setResult(null);

      try {
        // 1. Get distance via Mapbox
        const { data: routeData, error: routeError } = await supabase.functions.invoke(
          'mapbox-proxy',
          {
            body: {
              action: 'directions',
              origin: input.originCoords,
              destination: input.destinationCoords,
            },
          }
        );

        if (routeError || !routeData?.distance_km) {
          setError('No se pudo calcular la ruta. Verifique las ubicaciones.');
          return null;
        }

        const distance_km = routeData.distance_km;
        const estimated_time_hours = routeData.estimated_time_hours;

        // 2. Find consumption rate for crane type
        const rate = consumptionRates?.find(
          (r: ConsumptionRate) => r.crane_type === input.craneType
        );

        if (!rate) {
          setError(`No hay tasa de consumo configurada para tipo de grúa "${input.craneType}".`);
          return null;
        }

        // 3. Calculate fuel
        const factor =
          input.vehicleConfig === '2_vehicles'
            ? rate.towing_consumption_factor
            : rate.loaded_consumption_factor;

        const liters = distance_km * rate.base_consumption_per_km * factor;

        // Find current fuel price
        const fuelPrice = fuelPrices?.find((fp) => fp.fuel_type === rate.fuel_type);
        if (!fuelPrice) {
          setError(
            `No hay precio de combustible vigente para "${rate.fuel_type}". Registre un precio en la pestaña Combustible.`
          );
          return null;
        }

        const fuelCost = liters * fuelPrice.price_per_liter;

        // 4. Tolls
        const tollCost = input.manualTollCost ?? 0;

        // 5. Additional costs
        const additionalCosts = input.additionalCosts ?? 0;

        const calculationResult: TripCalculationResult = {
          distance_km,
          estimated_time_hours,
          fuel: {
            liters: Math.round(liters * 10) / 10,
            price_per_liter: fuelPrice.price_per_liter,
            fuel_type: rate.fuel_type,
            total_cost: Math.round(fuelCost),
            consumption_rate: rate.base_consumption_per_km,
            factor_used: factor,
          },
          tolls: {
            total_cost: tollCost,
            is_manual: !input.tollDetails?.length,
            details: input.tollDetails,
          },
          additional_costs: additionalCosts,
          total_estimate: Math.round(fuelCost + tollCost + additionalCosts),
        };

        setResult(calculationResult);
        return calculationResult;
      } catch {
        setError('Error inesperado al calcular el viaje.');
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    [fuelPrices, consumptionRates]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { calculate, result, error, isCalculating, reset };
}
