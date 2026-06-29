import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useFuelPrices");

export interface FuelPrice {
  id: string;
  fuel_type: string;
  price_per_liter: number;
  price_date: string;
  region: string | null;
  source: string | null;
  is_current: boolean;
  currency: string;
  created_at: string;
  updated_by: string | null;
}

interface ReferenceStationApiFuel {
  nombre_corto: string;
  nombre_largo: string;
  precio: string;
  precio_fecha: string;
  tipo_atencion: number;
}

interface ReferenceStationApiResponse {
  data?: {
    id: number;
    direccion: string;
    region: string;
    comuna: string;
    combustibles?: ReferenceStationApiFuel[];
  };
}

interface SyncedFuelPriceInput {
  fuel_type: string;
  price_per_liter: number;
  price_date: string;
  region: string;
  source: string;
}

export interface FuelPriceSyncResult {
  synced: number;
  skipped: number;
  stationLabel: string;
}

const FUEL_PRICES_SELECT = `
  id,
  fuel_type,
  price_per_liter,
  price_date,
  region,
  source,
  is_current,
  currency,
  created_at,
  updated_by
`;

const FUEL_TYPE_LABELS: Record<string, string> = {
  diesel: 'Diesel',
  gasolina_93: 'Gasolina 93',
  gasolina_95: 'Gasolina 95',
};

export const getFuelTypeLabel = (type: string) => FUEL_TYPE_LABELS[type] || type;

export const FUEL_TYPES = Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export const REFERENCE_FUEL_STATION = {
  id: 133,
  brand: 'COPEC',
  region: 'Atacama',
  comuna: 'Copiapó',
  address: 'Ruta 5 Norte Km 838, Costado Nortes N° 2 S/N Ruta 5 Oriente',
} as const;

export const REFERENCE_FUEL_STATION_LABEL = `${REFERENCE_FUEL_STATION.brand} ${REFERENCE_FUEL_STATION.comuna}`;
export const REFERENCE_FUEL_SOURCE = `Bencina en Línea · ${REFERENCE_FUEL_STATION_LABEL}`;

const EXTERNAL_FUEL_TYPE_MAP: Record<string, string> = {
  '93': 'gasolina_93',
  '95': 'gasolina_95',
  DI: 'diesel',
};

function parseFuelPrice(rawPrice: string): number {
  const normalized = rawPrice.replace(',', '.');
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`Precio inválido recibido desde la estación de referencia: ${rawPrice}`);
  }

  return parsed;
}

export function mapReferenceStationFuelPrices(payload: ReferenceStationApiResponse): SyncedFuelPriceInput[] {
  const station = payload.data;

  if (!station) {
    throw new Error('No se recibieron datos de la estación de referencia.');
  }

  const combustibles = station.combustibles ?? [];

  return combustibles
    .filter((combustible) => combustible.tipo_atencion === 2)
    .map((combustible) => {
      const fuelType = EXTERNAL_FUEL_TYPE_MAP[combustible.nombre_corto];

      if (!fuelType) {
        return null;
      }

      return {
        fuel_type: fuelType,
        price_per_liter: parseFuelPrice(combustible.precio),
        price_date: combustible.precio_fecha.slice(0, 10),
        region: station.region || REFERENCE_FUEL_STATION.region,
        source: REFERENCE_FUEL_SOURCE,
      };
    })
    .filter((fuel): fuel is SyncedFuelPriceInput => Boolean(fuel));
}

async function fetchReferenceStationFuelPrices(): Promise<SyncedFuelPriceInput[]> {
  const response = await fetch(`https://api.bencinaenlinea.cl/api/estacion_ciudadano/${REFERENCE_FUEL_STATION.id}`);

  if (!response.ok) {
    throw new Error(`No se pudo consultar la estación de referencia (${response.status}).`);
  }

  const payload = (await response.json()) as ReferenceStationApiResponse;
  return mapReferenceStationFuelPrices(payload);
}

async function setCurrentFuelPrice(price: SyncedFuelPriceInput) {
  const { error: deactivateError } = await supabase
    .from('fuel_prices')
    .update({ is_current: false })
    .eq('fuel_type', price.fuel_type)
    .eq('is_current', true);

  if (deactivateError) {
    throw deactivateError;
  }

  const { error: insertError } = await supabase
    .from('fuel_prices')
    .insert({
      ...price,
      is_current: true,
      currency: 'CLP',
    });

  if (insertError) {
    throw insertError;
  }
}

export const REGIONS = [
  { value: 'Nacional', label: 'Nacional' },
  { value: 'RM', label: 'Región Metropolitana' },
  { value: 'Norte', label: 'Norte' },
  { value: 'Centro', label: 'Centro' },
  { value: 'Sur', label: 'Sur' },
];

export function useCurrentFuelPrices() {
  return useQuery({
    queryKey: ['fuel-prices', 'current'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_prices')
        .select(FUEL_PRICES_SELECT)
        .eq('is_current', true)
        .order('fuel_type');
      if (error) throw error;
      return data as FuelPrice[];
    },
  });
}

export function useFuelPriceHistory(fuelType?: string, region?: string) {
  return useQuery({
    queryKey: ['fuel-prices', 'history', fuelType, region],
    queryFn: async () => {
      let query = supabase
        .from('fuel_prices')
        .select(FUEL_PRICES_SELECT)
        .order('price_date', { ascending: false })
        .order('fuel_type');

      if (fuelType && fuelType !== 'all') {
        query = query.eq('fuel_type', fuelType);
      }
      if (region && region !== 'all') {
        query = query.eq('region', region);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FuelPrice[];
    },
  });
}

export function useAddFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (price: {
      fuel_type: string;
      price_per_liter: number;
      price_date: string;
      region: string;
      source: string;
    }) => {
      // Deactivate current prices for this fuel type
      await supabase
        .from('fuel_prices')
        .update({ is_current: false })
        .eq('fuel_type', price.fuel_type)
        .eq('is_current', true);

      // Insert new current price
      const { data, error } = await supabase
        .from('fuel_prices')
        .insert({
          ...price,
          is_current: true,
          currency: 'CLP',
        })
        .select(FUEL_PRICES_SELECT)
        .single();

      if (error) {
        logger.error('[useFuelPrices] Error insertando precio de combustible:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}

export function useUpdateFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<FuelPrice> & { id: string }) => {
      const { data, error } = await supabase
        .from('fuel_prices')
        .update(updates)
        .eq('id', id)
        .select(FUEL_PRICES_SELECT)
        .single();
      if (error) {
        logger.error('[useFuelPrices] Error actualizando precio de combustible:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}

export function useDeleteFuelPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fuel_prices')
        .delete()
        .eq('id', id);
      if (error) {
        logger.error('[useFuelPrices] Error eliminando precio de combustible:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}

export function useSyncReferenceFuelPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const fetchedPrices = await fetchReferenceStationFuelPrices();

      if (fetchedPrices.length === 0) {
        throw new Error('La estación de referencia no devolvió precios utilizables.');
      }

      const fuelTypes = fetchedPrices.map((price) => price.fuel_type);
      const { data: currentPrices, error } = await supabase
        .from('fuel_prices')
        .select(FUEL_PRICES_SELECT)
        .in('fuel_type', fuelTypes)
        .eq('is_current', true);

      if (error) {
        throw error;
      }

      let synced = 0;
      let skipped = 0;

      for (const fetchedPrice of fetchedPrices) {
        const currentPrice = (currentPrices as FuelPrice[]).find(
          (price) => price.fuel_type === fetchedPrice.fuel_type
        );

        const alreadyCurrent =
          currentPrice &&
          currentPrice.price_per_liter === fetchedPrice.price_per_liter &&
          currentPrice.price_date === fetchedPrice.price_date &&
          currentPrice.region === fetchedPrice.region &&
          currentPrice.source === fetchedPrice.source;

        if (alreadyCurrent) {
          skipped += 1;
          continue;
        }

        await setCurrentFuelPrice(fetchedPrice);
        synced += 1;
      }

      return {
        synced,
        skipped,
        stationLabel: REFERENCE_FUEL_STATION_LABEL,
      } satisfies FuelPriceSyncResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });
}
