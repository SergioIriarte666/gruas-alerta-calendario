import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useTollCalculationV2');

export interface TollBreakdown {
  stationName: string;
  concessionName: string;
  highway: string | null;
  stationType: string;
  rateAmount: number;
  vehicleCategory: string;
  source: 'getapi' | 'fallback';
}

export interface TollResultV2 {
  totalCost: number;
  breakdown: TollBreakdown[];
  category: string;
  source: 'getapi_matched' | 'fallback_range' | 'manual';
  warning?: string;
}

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const effectiveTollCategory = (
  craneCategory: string,
  twoVehicles: boolean,
): string => {
  if (twoVehicles) return 'CAMION_PESADO';
  if (craneCategory === 'LIVIANO_REMOLQUE') return 'LIVIANO';
  if (craneCategory === 'BUS_PESADO') return 'CAMION_PESADO';
  return craneCategory;
};

const estimateKmFromName = (
  cityName: string,
  stations: Array<{ stationName: string; kmMarker: number | null; concessionName: string }>,
): number | null => {
  const normalized = norm(cityName);

  for (const station of stations) {
    if (
      norm(station.stationName).includes(normalized) ||
      normalized.includes(norm(station.stationName))
    ) {
      return station.kmMarker;
    }

    const parts = station.concessionName.split(/[-–]/);
    for (const part of parts) {
      const normalizedPart = norm(part.trim());
      if (normalizedPart.includes(normalized) || normalized.includes(normalizedPart)) {
        return station.kmMarker;
      }
    }
  }

  const known: Record<string, number> = {
    santiago: 0,
    lampa: 37,
    'las vegas': 104,
    pichidangui: 185,
    'el melon': 209,
    'los vilos': 229,
    ovalle: 310,
    'la serena': 472,
    vallenar: 653,
    copiapo: 806,
    caldera: 840,
    antofagasta: 1360,
    iquique: 1850,
  };

  for (const [key, km] of Object.entries(known)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return km;
    }
  }

  return null;
};

export function useTollCalculationV2() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<TollResultV2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(
    async ({
      originName,
      destName,
      originCoords,
      destCoords,
      craneCategory,
      twoVehicles,
    }: {
      originName: string;
      destName: string;
      originCoords: [number, number] | null;
      destCoords: [number, number] | null;
      craneCategory: string;
      twoVehicles: boolean;
    }): Promise<TollResultV2 | null> => {
      setIsCalculating(true);
      setError(null);
      setResult(null);

      const category = effectiveTollCategory(craneCategory, twoVehicles);
      logger.debug('Calculando peajes', { originName, destName, category, twoVehicles });

      try {
        const { data: allRates, error: dbError } = await supabase
          .from('toll_rates_current')
          .select('*')
          .eq('vehicle_category', category);

        if (dbError) throw dbError;

        if (!allRates || allRates.length === 0) {
          setError('No hay tarifas cargadas en el sistema. Ve a Admin → Tarifas de Peajes.');
          return null;
        }

        const stationIndex = allRates.map((rate) => ({
          stationName: rate.station_name as string,
          concessionName: rate.concession_name as string,
          highway: rate.highway as string | null,
          stationType: rate.station_type as string,
          rateAmount: Number(rate.rate_amount),
          kmMarker: rate.km_marker ? Number(rate.km_marker) : null,
        }));

        let getApiStations: string[] = [];

        try {
          const { data: apiData, error: apiInvokeError } = await supabase.functions.invoke(
            'tollroutes-proxy',
            {
              body: {
                action: 'route-cost-by-coords',
                origin: originCoords
                  ? { lat: originCoords[1], lng: originCoords[0] }
                  : undefined,
                destination: destCoords
                  ? { lat: destCoords[1], lng: destCoords[0] }
                  : undefined,
                categoryCode: category === 'LIVIANO' ? 'LIVIANO' : 'PESADO',
              },
            },
          );

          if (apiInvokeError) {
            throw apiInvokeError;
          }

          if (apiData?.data?.details?.length > 0) {
            getApiStations = apiData.data.details.map((detail: any) => detail.peaje as string);
            logger.debug('GetAPI peajes detectados', getApiStations);
          } else if (apiData?.details?.length > 0) {
            getApiStations = apiData.details.map((detail: any) => detail.peaje as string);
            logger.debug('GetAPI peajes detectados', getApiStations);
          }
        } catch (apiError) {
          logger.warn('GetAPI no disponible, usando fallback por rango km', apiError);
        }

        let breakdown: TollBreakdown[] = [];
        let source: TollResultV2['source'] = 'fallback_range';

        if (getApiStations.length > 0) {
          for (const apiStation of getApiStations) {
            const normalizedApiStation = norm(apiStation);
            const firstWord = normalizedApiStation.split(' ')[0] ?? '';

            const match = stationIndex.find(
              (station) =>
                norm(station.stationName).includes(normalizedApiStation) ||
                normalizedApiStation.includes(norm(station.stationName)) ||
                (firstWord.length >= 5 && norm(station.stationName).startsWith(firstWord)),
            );

            if (match) {
              breakdown.push({
                stationName: match.stationName,
                concessionName: match.concessionName,
                highway: match.highway,
                stationType: match.stationType,
                rateAmount: match.rateAmount,
                vehicleCategory: category,
                source: 'getapi',
              });
            } else {
              logger.warn('Peaje GetAPI sin match en BD', apiStation);
            }
          }

          if (breakdown.length > 0) {
            source = 'getapi_matched';
          }
        }

        if (breakdown.length === 0) {
          const kmOrigin = estimateKmFromName(originName, stationIndex);
          const kmDest = estimateKmFromName(destName, stationIndex);

          logger.debug('Fallback km range', { kmOrigin, kmDest });

          if (kmOrigin !== null && kmDest !== null) {
            const kmMin = Math.min(kmOrigin, kmDest);
            const kmMax = Math.max(kmOrigin, kmDest);

            breakdown = stationIndex
              .filter(
                (station) =>
                  station.stationType === 'TRONCAL' &&
                  station.kmMarker !== null &&
                  station.kmMarker >= kmMin &&
                  station.kmMarker <= kmMax,
              )
              .map((station) => ({
                stationName: station.stationName,
                concessionName: station.concessionName,
                highway: station.highway,
                stationType: station.stationType,
                rateAmount: station.rateAmount,
                vehicleCategory: category,
                source: 'fallback' as const,
              }));

            source = 'fallback_range';
          }
        }

        if (breakdown.length === 0) {
          const noTollsResult: TollResultV2 = {
            totalCost: 0,
            breakdown: [],
            category,
            source: 'fallback_range',
            warning: 'No se encontraron peajes en este tramo. Verifica el origen y destino.',
          };

          setResult(noTollsResult);
          return noTollsResult;
        }

        const totalCost = breakdown.reduce((sum, item) => sum + item.rateAmount, 0);
        const warning =
          source === 'fallback_range'
            ? 'Estimación basada en rango de km. Los peajes laterales no están incluidos.'
            : twoVehicles
              ? 'Categoría ajustada a Camión Pesado por llevar 2 vehículos.'
              : undefined;

        const tollResult: TollResultV2 = {
          totalCost,
          breakdown,
          category,
          source,
          warning,
        };

        setResult(tollResult);
        logger.debug('Resultado peajes', tollResult);
        return tollResult;
      } catch (calcError: any) {
        logger.error('Error calculando peajes', calcError);
        setError('Error al calcular peajes. Puedes ingresar el monto manualmente.');
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { calculate, result, error, isCalculating, reset };
}
