import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useTollManagement');

export interface TollConcession {
  id: string;
  name: string;
  route: string;
  direction: string;
  kmStart: number | null;
  kmEnd: number | null;
  pdfUrl: string | null;
  validFrom: string;
  validUntil: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface TollStation {
  id: string;
  name: string;
  location: string;
  highway: string | null;
  stationType: 'TRONCAL' | 'LATERAL' | 'ACCESO';
  concessionId: string | null;
  concessionName?: string;
  kmMarker: number | null;
  isActive: boolean;
}

export interface TollRate {
  id: string;
  stationId: string;
  stationName?: string;
  vehicleCategory: string;
  rateAmount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
}

export interface TollRateCurrent {
  concessionName: string;
  route: string;
  stationName: string;
  highway: string | null;
  stationType: string;
  kmMarker: number | null;
  vehicleCategory: string;
  rateAmount: number;
  rateValidFrom: string;
  rateValidUntil: string | null;
  rateId: string;
  stationId: string;
  concessionId: string;
}

export const TOLL_VEHICLE_CATEGORIES = [
  { value: 'LIVIANO', label: 'Liviano (Auto / Camioneta)' },
  { value: 'CAMION_2_EJES', label: 'Camión 2 Ejes / Doble Rueda' },
  { value: 'CAMION_PESADO', label: 'Camión Pesado (+2 Ejes)' },
] as const;

export const useTollConcessions = () =>
  useQuery({
    queryKey: ['toll-concessions'],
    queryFn: async (): Promise<TollConcession[]> => {
      const { data, error } = await supabase
        .from('toll_concessions')
        .select('*')
        .order('km_start', { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        route: row.route,
        direction: row.direction,
        kmStart: row.km_start,
        kmEnd: row.km_end,
        pdfUrl: row.pdf_url,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        notes: row.notes,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

export const useTollRatesCurrent = () =>
  useQuery({
    queryKey: ['toll-rates-current'],
    queryFn: async (): Promise<TollRateCurrent[]> => {
      const { data, error } = await supabase
        .from('toll_rates_current')
        .select('*')
        .order('km_marker', { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        concessionName: row.concession_name ?? '',
        route: row.route ?? '',
        stationName: row.station_name ?? '',
        highway: row.highway,
        stationType: row.station_type ?? '',
        kmMarker: row.km_marker,
        vehicleCategory: row.vehicle_category ?? '',
        rateAmount: Number(row.rate_amount ?? 0),
        rateValidFrom: row.rate_valid_from ?? '',
        rateValidUntil: row.rate_valid_until,
        rateId: row.rate_id ?? '',
        stationId: row.station_id ?? '',
        concessionId: row.concession_id ?? '',
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

export interface NewStationInput {
  name: string;
  location: string;
  highway?: string;
  stationType: 'TRONCAL' | 'LATERAL' | 'ACCESO';
  concessionId: string;
  kmMarker?: number;
}

export interface NewRateInput {
  stationId: string;
  vehicleCategory: string;
  rateAmount: number;
  validFrom: string;
}

export const useCreateConcession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<TollConcession, 'id' | 'createdAt' | 'isActive'>,
    ) => {
      const { data, error } = await supabase
        .from('toll_concessions')
        .insert({
          name: input.name,
          route: input.route,
          direction: input.direction,
          km_start: input.kmStart,
          km_end: input.kmEnd,
          pdf_url: input.pdfUrl,
          valid_from: input.validFrom,
          valid_until: input.validUntil,
          notes: input.notes,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-concessions'] });
      toast.success('Concesión creada');
    },
    onError: (error: any) => {
      toast.error('Error al crear concesión', { description: error.message });
    },
  });
};

export const useCreateTollStation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewStationInput) => {
      const { data, error } = await supabase
        .from('toll_stations')
        .insert({
          name: input.name,
          location: input.location,
          highway: input.highway ?? null,
          station_type: input.stationType,
          concession_id: input.concessionId,
          km_marker: input.kmMarker ?? null,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-rates-current'] });
      toast.success('Peaje creado');
    },
    onError: (error: any) => {
      toast.error('Error al crear peaje', { description: error.message });
    },
  });
};

export const useCreateTollRatesBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewRateInput[]) => {
      if (input.length === 0) {
        throw new Error('No hay tarifas para guardar');
      }

      const rows = input.map((rate) => ({
        toll_station_id: rate.stationId,
        vehicle_category: rate.vehicleCategory,
        rate_amount: rate.rateAmount,
        valid_from: rate.validFrom,
        is_active: true,
      }));

      const { error } = await supabase.from('toll_rates').insert(rows);
      if (error) throw error;

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['toll-rates-current'] });
      toast.success(`${count} tarifas creadas`);
    },
    onError: (error: any) => {
      toast.error('Error al crear tarifas', { description: error.message });
    },
  });
};

export const useUpdateTollRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rateId,
      newAmount,
      validFrom,
    }: {
      rateId: string;
      newAmount: number;
      validFrom: string;
    }) => {
      const { data: current, error: fetchError } = await supabase
        .from('toll_rates')
        .select('toll_station_id, vehicle_category')
        .eq('id', rateId)
        .single();

      if (fetchError) throw fetchError;

      const { error: deactivateError } = await supabase
        .from('toll_rates')
        .update({ is_active: false, valid_until: validFrom })
        .eq('id', rateId);

      if (deactivateError) throw deactivateError;

      const { error: insertError } = await supabase.from('toll_rates').insert({
        toll_station_id: current.toll_station_id,
        vehicle_category: current.vehicle_category,
        rate_amount: newAmount,
        valid_from: validFrom,
        is_active: true,
      });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-rates-current'] });
      toast.success('Tarifa actualizada');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar tarifa', { description: error.message });
    },
  });
};

export const useUpdateTollStationKm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stationId,
      kmMarker,
    }: {
      stationId: string;
      kmMarker: number | null;
    }) => {
      const { error } = await supabase
        .from('toll_stations')
        .update({ km_marker: kmMarker })
        .eq('id', stationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-rates-current'] });
      toast.success('Km del peaje actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar km', { description: error.message });
    },
  });
};

export interface ParsedTollRate {
  stationName: string;
  vehicleCategory: string;
  rateAmount: number;
}

export const useApplyParsedRates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      concessionId,
      validFrom,
      rates,
    }: {
      concessionId: string;
      validFrom: string;
      rates: ParsedTollRate[];
    }) => {
      const { data: stations, error: stationsError } = await supabase
        .from('toll_stations')
        .select('id, name')
        .eq('concession_id', concessionId)
        .eq('is_active', true);

      if (stationsError) throw stationsError;

      const stationMap = new Map(
        (stations || []).map((station) => [station.name.toLowerCase().trim(), station.id]),
      );

      const updates: Array<{ stationId: string; category: string; amount: number }> = [];
      const notFound: string[] = [];

      for (const rate of rates) {
        const stationId = stationMap.get(rate.stationName.toLowerCase().trim());
        if (!stationId) {
          notFound.push(rate.stationName);
          continue;
        }

        updates.push({
          stationId,
          category: rate.vehicleCategory,
          amount: rate.rateAmount,
        });
      }

      if (notFound.length > 0) {
        logger.warn('Peajes no encontrados en BD', notFound);
      }

      for (const update of updates) {
        const { error: deactivateError } = await supabase
          .from('toll_rates')
          .update({ is_active: false, valid_until: validFrom })
          .eq('toll_station_id', update.stationId)
          .eq('vehicle_category', update.category)
          .eq('is_active', true);

        if (deactivateError) throw deactivateError;

        const { error: insertError } = await supabase.from('toll_rates').insert({
          toll_station_id: update.stationId,
          vehicle_category: update.category,
          rate_amount: update.amount,
          valid_from: validFrom,
          is_active: true,
        });

        if (insertError) throw insertError;
      }

      return { updated: updates.length, notFound };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['toll-rates-current'] });
      if (result.notFound.length > 0) {
        toast.warning(
          `${result.updated} tarifas actualizadas. No encontrados: ${result.notFound.join(', ')}`,
        );
      } else {
        toast.success(`${result.updated} tarifas actualizadas correctamente`);
      }
    },
    onError: (error: any) => {
      toast.error('Error al aplicar tarifas', { description: error.message });
    },
  });
};
