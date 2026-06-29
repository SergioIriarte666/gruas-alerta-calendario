import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useTollCalculationV2');

export interface TollBreakdown {
  stationId?: string;
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
  idaCost: number;
  vueltaCost: number;
  breakdown: TollBreakdown[];
  category: string;
  returnCategory: string;
  source: 'getapi_matched' | 'fallback_range';
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

const KNOWN_KM: Record<string, number> = {
  'santiago': 0,
  'lampa': 26,
  'las vegas': 89,
  'til til': 89,
  'llay llay': 89,
  'tunel el melon': 127,
  'el melon': 127,
  'la calera': 127,
  'pichidangui': 193,
  'los vilos': 229,
  'longotoma': 283,
  'ovalle': 310,
  'tongoy': 409,
  'guanaqueros': 409,
  'la serena': 472,
  'punta colorada': 554,
  'la higuera': 554,
  'cachiyuyo': 598,
  'freirina': 598,
  'vallenar': 653,
  'totoral': 731,
  'copiapo': 841,
  'caldera': 841,
  'antofagasta': 1360,
  'calama': 1511,
  'iquique': 1850,
};

const DUPLICATE_KM_MARKERS = new Set(
  Object.values(KNOWN_KM).filter(
    (km, index, values) => values.indexOf(km) !== index,
  ),
);

const estimateKm = (
  cityName: string,
  stations: Array<{ stationName: string; kmMarker: number | null; concessionName: string }>,
): number | null => {
  const normalized = norm(cityName);

  for (const station of stations) {
    if (station.kmMarker === null) continue;
    if (
      norm(station.stationName).includes(normalized) ||
      normalized.includes(norm(station.stationName))
    ) {
      return station.kmMarker;
    }
  }

  for (const [key, km] of Object.entries(KNOWN_KM)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return km;
    }
  }

  return null;
};

const normalizeRouteName = (value: string) => norm(value);

const resolveKnownKmReference = (cityName: string): number | null => {
  const normalized = norm(cityName);

  for (const [key, km] of Object.entries(KNOWN_KM)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return km;
    }
  }

  return null;
};

export function hasAmbiguousKmReference(cityName: string): boolean {
  const km = resolveKnownKmReference(cityName);
  return km !== null && DUPLICATE_KM_MARKERS.has(km);
}

export function canUseFallbackRange(
  originName: string,
  destName: string,
  kmOrigin: number | null,
  kmDest: number | null,
): boolean {
  if (kmOrigin === null || kmDest === null) {
    return false;
  }

  if (kmOrigin === kmDest) {
    return false;
  }

  if (hasAmbiguousKmReference(originName) || hasAmbiguousKmReference(destName)) {
    return false;
  }

  return true;
}

export function shouldExcludeFallbackStation(
  stationName: string,
  originName: string,
  destName: string,
): boolean {
  const normalizedStation = normalizeRouteName(stationName);
  const normalizedOrigin = normalizeRouteName(originName);
  const normalizedDest = normalizeRouteName(destName);

  const routeTouchesCopiapo =
    normalizedOrigin.includes('copiapo') || normalizedDest.includes('copiapo');
  const routeTouchesCaldera =
    normalizedOrigin.includes('caldera') || normalizedDest.includes('caldera');

  // Puerto Viejo corresponde al tramo hacia Caldera; no debe incluirse
  // cuando la ruta usa Copiapó pero no entra a Caldera.
  if (
    normalizedStation.includes('puerto viejo') &&
    routeTouchesCopiapo &&
    !routeTouchesCaldera
  ) {
    return true;
  }

  return false;
}

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
      returnConfig = 'empty',
    }: {
      originName: string;
      destName: string;
      originCoords: [number, number] | null;
      destCoords: [number, number] | null;
      craneCategory: string;
      twoVehicles: boolean;
      returnConfig?: 'empty' | '1_vehicle' | '2_vehicles';
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
          stationId: rate.station_id as string,
          stationName: rate.station_name as string,
          concessionName: rate.concession_name as string,
          highway: rate.highway as string | null,
          stationType: rate.station_type as string,
          rateAmount: Number(rate.rate_amount),
          kmMarker: rate.km_marker ? Number(rate.km_marker) : null,
        }));

        let getApiStations: string[] = [];
        let exactLookupStatus: 'matched' | 'no_results' | 'unmatched' | 'failed' = 'failed';
        let exactLookupReturnedZero = false;

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

          if (apiData?.error) {
            throw new Error(apiData.error);
          }

          const apiDetails = Array.isArray(apiData?.data?.details)
            ? apiData.data.details
            : Array.isArray(apiData?.details)
              ? apiData.details
              : [];

          const apiTotal =
            typeof apiData?.data?.total === 'number'
              ? Number(apiData.data.total)
              : typeof apiData?.total === 'number'
                ? Number(apiData.total)
                : null;

          exactLookupReturnedZero = apiTotal === 0;

          if (apiDetails.length > 0) {
            getApiStations = apiDetails.map((detail: any) => detail.peaje as string);
            logger.debug('GetAPI peajes detectados', getApiStations);
            exactLookupStatus = 'matched';
          } else {
            exactLookupStatus = 'no_results';
          }
        } catch (apiError) {
          logger.warn('GetAPI no disponible, usando fallback por rango km', apiError);
          exactLookupStatus = 'failed';
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
                stationId: match.stationId,
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
          } else {
            exactLookupStatus = 'unmatched';
          }
        }

        if (breakdown.length === 0) {
          if (exactLookupStatus === 'no_results' && exactLookupReturnedZero) {
            const noTollsExactResult: TollResultV2 = {
              totalCost: 0,
              idaCost: 0,
              vueltaCost: 0,
              breakdown: [],
              category,
              returnCategory: category,
              source: 'getapi_matched',
            };

            setResult(noTollsExactResult);
            return noTollsExactResult;
          }

          if (exactLookupStatus === 'unmatched') {
            setError(
              'La ruta fue identificada, pero faltan equivalencias de peajes en la base. Ingresa el monto manualmente para evitar cobros incorrectos.',
            );
            return null;
          }

          const kmOrigin = estimateKm(originName, stationIndex);
          const kmDest = estimateKm(destName, stationIndex);

          logger.debug('Fallback km range', { kmOrigin, kmDest });

          if (
            exactLookupStatus === 'failed' &&
            canUseFallbackRange(originName, destName, kmOrigin, kmDest)
          ) {
            const kmMin = Math.min(kmOrigin, kmDest);
            const kmMax = Math.max(kmOrigin, kmDest);

            breakdown = stationIndex
              .filter(
                (station) =>
                  station.stationType === 'TRONCAL' &&
                  station.kmMarker !== null &&
                  station.kmMarker >= kmMin &&
                  station.kmMarker <= kmMax &&
                  !shouldExcludeFallbackStation(station.stationName, originName, destName),
              )
              .sort((a, b) => (a.kmMarker ?? 0) - (b.kmMarker ?? 0))
              .map((station) => ({
                stationId: station.stationId,
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
          setError(
            exactLookupStatus === 'failed'
              ? 'No se pudo validar la ruta exacta de peajes. Ingresa el monto manualmente para evitar incluir peajes fuera de trayecto.'
              : 'No se pudo determinar con certeza los peajes de esta ruta. Ingresa el monto manualmente para evitar cobros incorrectos.',
          );
          return null;
        }

        // Costo de ida
        const idaCost = breakdown.reduce((sum, item) => sum + item.rateAmount, 0);

        // La grúa siempre vuelve a la base en Copiapó, por lo que los peajes
        // se pagan dos veces. La categoría de vuelta solo sube a CAMION_PESADO
        // si retorna con 2 vehículos; vuelta vacía conserva la categoría de ida.
        const returnTwoVehicles = returnConfig === '2_vehicles';
        const returnCategory = effectiveTollCategory(craneCategory, returnTwoVehicles);

        let vueltaCost = idaCost;
        if (returnCategory !== category) {
          const { data: returnRates } = await supabase
            .from('toll_rates_current')
            .select('station_id, rate_amount')
            .eq('vehicle_category', returnCategory);

          if (returnRates && returnRates.length > 0) {
            const returnRateMap = new Map(
              returnRates.map((rate: any) => [rate.station_id as string, Number(rate.rate_amount)]),
            );
            vueltaCost = breakdown.reduce(
              (sum, item) => sum + (returnRateMap.get(item.stationId ?? '') ?? item.rateAmount),
              0,
            );
          }
        }

        const totalCost = idaCost + vueltaCost;
        const warning =
          source === 'fallback_range'
            ? 'Estimación basada en rango de km. Los peajes laterales no están incluidos.'
            : twoVehicles
              ? 'Categoría ajustada a Camión Pesado por llevar 2 vehículos.'
              : undefined;

        const tollResult: TollResultV2 = {
          totalCost,
          idaCost,
          vueltaCost,
          breakdown,
          category,
          returnCategory,
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
