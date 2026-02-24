import { useMemo } from 'react';
import { TransportCostEstimate, CraneConsumptionRate } from '@/types/transport';

interface CalculationParams {
  distanceKm: number;
  craneType: string;
  consumptionFactor: number;
  vehicleCount: 1 | 2;
  fuelPricePerLiter: number;
  consumptionRates: CraneConsumptionRate[];
  tollAmounts: Array<{ name: string; craneRate: number; vehicleRate: number }>;
  operatorPerDiem?: number;
}

export const useTransportCalculation = (params: CalculationParams | null): TransportCostEstimate | null => {
  return useMemo(() => {
    if (!params || !params.distanceKm || !params.fuelPricePerLiter) return null;

    const rate = params.consumptionRates.find(r => r.crane_type === params.craneType);
    if (!rate) return null;

    const baseLitersPerKm = rate.base_consumption_per_km;
    const loadFactor = rate.loaded_consumption_factor;
    const towingFactor = params.vehicleCount === 2 ? rate.towing_consumption_factor : 1;

    const totalLiters = params.distanceKm * baseLitersPerKm * params.consumptionFactor * loadFactor * towingFactor;
    const fuelCost = totalLiters * params.fuelPricePerLiter;

    const craneTolls = params.tollAmounts.reduce((sum, t) => sum + t.craneRate, 0);
    const vehicleTolls = params.vehicleCount === 2
      ? params.tollAmounts.reduce((sum, t) => sum + t.vehicleRate, 0)
      : 0;
    const totalTolls = craneTolls + vehicleTolls;

    const operatorPerDiem = params.operatorPerDiem || 0;
    const vehicleWear = Math.round(params.distanceKm * 50); // $50 CLP/km approx wear
    const additionalTotal = operatorPerDiem + vehicleWear;

    return {
      fuelCost: {
        baseLitersPerKm,
        routeDistance: params.distanceKm,
        consumptionFactor: params.consumptionFactor,
        loadFactor,
        towingFactor,
        currentFuelPrice: params.fuelPricePerLiter,
        totalLiters: Math.round(totalLiters * 10) / 10,
        totalCost: Math.round(fuelCost),
      },
      tollCosts: {
        tolls: params.tollAmounts.map(t => ({
          name: t.name,
          amount: t.craneRate + (params.vehicleCount === 2 ? t.vehicleRate : 0),
        })),
        craneTolls,
        vehicleTolls,
        totalTolls,
      },
      additionalCosts: {
        operatorPerDiem,
        vehicleWear,
        total: additionalTotal,
      },
      totalEstimate: Math.round(fuelCost + totalTolls + additionalTotal),
    };
  }, [params]);
};
