import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { RouteGeometry } from '@/lib/routeDirections';

const logger = createLogger('useTollCalculationV3');

export interface TollPlazaV3 {
  name: string;
  highway?: string;
  amount: number;
}

export interface TollResultV3 {
  totalCost: number;      // ida + vuelta
  idaCost: number;
  vueltaCost: number;
  breakdown: TollPlazaV3[];       // plazas de ida
  returnBreakdown: TollPlazaV3[]; // plazas de vuelta
  category: string;
  returnCategory: string;
  source: 'api';
}

// Migrada desde V2 — misma lógica de negocio de categorías
export const effectiveTollCategory = (craneCategory: string, twoVehicles: boolean): string => {
  if (twoVehicles) return 'CAMION_PESADO';
  if (craneCategory === 'LIVIANO_REMOLQUE') return 'LIVIANO';
  if (craneCategory === 'BUS_PESADO') return 'CAMION_PESADO';
  return craneCategory;
};

// Cache en memoria por sesión: evita repetir llamadas idénticas
// (ratelimit del plan: 7 req/min). Clave: extremos de ruta redondeados + categoría.
const sessionCache = new Map<string, { total: number; details: TollPlazaV3[] }>();

const cacheKey = (coords: [number, number][], category: string) => {
  const first = coords[0];
  const last = coords[coords.length - 1];
  const r = (n: number) => n.toFixed(3);
  return `${r(first[0])},${r(first[1])}|${r(last[0])},${r(last[1])}|${category}`;
};

async function fetchTollsByPath(
  coordinates: [number, number][], // [lng, lat][] (formato Google/maps-proxy)
  category: string,
): Promise<{ total: number; details: TollPlazaV3[] }> {
  const key = cacheKey(coordinates, category);
  const cached = sessionCache.get(key);
  if (cached) {
    logger.debug('Peajes desde cache de sesión', { key });
    return cached;
  }

  const { data, error } = await supabase.functions.invoke('tollroutes-proxy', {
    body: {
      action: 'calculate-by-path',
      categoryCode: category,
      path: coordinates.map(([lng, lat]) => ({ lat, lng })),
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // Parser defensivo
  const raw = data?.data ?? data;
  const rawDetails: any[] = Array.isArray(raw?.details)
    ? raw.details
    : Array.isArray(raw?.tolls)
      ? raw.tolls
      : [];

  const details: TollPlazaV3[] = rawDetails.map((item) => ({
    name: String(item.peaje ?? item.name ?? item.plaza ?? 'Peaje'),
    highway: item.autopista ?? item.highway ?? item.concession ?? undefined,
    amount: Number(item.costo ?? item.monto ?? item.amount ?? item.cost ?? 0),
  }));

  const total =
    typeof raw?.total === 'number'
      ? Number(raw.total)
      : details.reduce((sum, item) => sum + item.amount, 0);

  const result = { total, details };
  sessionCache.set(key, result);
  return result;
}

export function useTollCalculationV3() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<TollResultV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresManualEntry, setRequiresManualEntry] = useState(false);

  const calculate = useCallback(
    async ({
      routeGeometry,
      craneCategory,
      twoVehicles,
      returnConfig = 'empty',
    }: {
      routeGeometry: RouteGeometry;
      craneCategory: string;
      twoVehicles: boolean;
      returnConfig?: 'empty' | '1_vehicle' | '2_vehicles';
    }): Promise<TollResultV3 | null> => {
      setIsCalculating(true);
      setError(null);
      setResult(null);
      setRequiresManualEntry(false);

      try {
        if (!routeGeometry?.coordinates?.length) {
          throw new Error('Sin geometría de ruta');
        }

        const category = effectiveTollCategory(craneCategory, twoVehicles);
        const returnCategory = effectiveTollCategory(craneCategory, returnConfig === '2_vehicles');

        logger.debug('Calculando peajes V3', { category, returnCategory, points: routeGeometry.coordinates.length });

        const ida = await fetchTollsByPath(routeGeometry.coordinates, category);

        // La grúa siempre vuelve a base. Si la categoría de vuelta es la misma,
        // las plazas y tarifas son idénticas — sin segunda llamada a la API.
        let vuelta = ida;
        let returnBreakdown = ida.details;
        if (returnCategory !== category) {
          const reversed = [...routeGeometry.coordinates].reverse();
          vuelta = await fetchTollsByPath(reversed, returnCategory);
          returnBreakdown = vuelta.details;
        }

        const tollResult: TollResultV3 = {
          totalCost: ida.total + vuelta.total,
          idaCost: ida.total,
          vueltaCost: vuelta.total,
          breakdown: ida.details,
          returnBreakdown,
          category,
          returnCategory,
          source: 'api',
        };

        setResult(tollResult);
        logger.debug('Resultado peajes V3', tollResult);
        return tollResult;
      } catch (calcError) {
        logger.error('Error calculando peajes V3', calcError);
        setRequiresManualEntry(true);
        setError('No se pudo obtener los peajes desde la API. Puedes ingresar el monto manualmente.');
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
    setRequiresManualEntry(false);
  }, []);

  return { calculate, result, error, isCalculating, requiresManualEntry, reset };
}
