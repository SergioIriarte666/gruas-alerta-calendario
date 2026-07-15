import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';
import { resolveRazonSocialesForRuts } from './rutResolver';

const logger = createLogger('LowboyRutResolver');

/** RUTs distintos (de la entidad) cuyos registros aún no tienen razón social. */
export function useLowboyMissingNames(entityRut: string) {
  const key = normalizeRut(entityRut);
  return useQuery({
    queryKey: ['lowboy-missing-names', key],
    enabled: !!key,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('sii_rcv_records')
        .select('counterpart_rut')
        .eq('entity_rut', key)
        .or('counterpart_name.is.null,counterpart_name.eq.');
      if (error) {
        logger.warn('No se pudieron leer registros sin razón social', error.message);
        return [];
      }
      return [...new Set((data ?? []).map((row) => row.counterpart_rut).filter(Boolean))];
    },
  });
}

export type BackfillResult = { completados: number; sinResultado: number };

/** Completa counterpart_name resolviendo cada RUT faltante (caché → API) y actualizando todos sus registros. */
export function useLowboyRutBackfill(entityRut: string) {
  const queryClient = useQueryClient();
  const key = normalizeRut(entityRut);

  return useMutation({
    mutationFn: async (missingRuts: string[]): Promise<BackfillResult> => {
      const uniqueRuts = [...new Set(missingRuts.map((r) => normalizeRut(r)).filter(Boolean))];
      if (uniqueRuts.length === 0) return { completados: 0, sinResultado: 0 };

      const resolved = await resolveRazonSocialesForRuts(uniqueRuts);

      let completados = 0;
      for (const rut of uniqueRuts) {
        const razon = resolved.get(rut);
        if (!razon) continue;
        const { error } = await supabase
          .from('sii_rcv_records')
          .update({ counterpart_name: razon })
          .eq('entity_rut', key)
          .eq('counterpart_rut', rut)
          .or('counterpart_name.is.null,counterpart_name.eq.');
        if (error) {
          logger.warn('No se pudo actualizar razón social', rut, error.message);
          continue;
        }
        completados += 1;
      }

      return { completados, sinResultado: uniqueRuts.length - completados };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sii-rcv'] }),
        queryClient.invalidateQueries({ queryKey: ['sii-rcv-imports'] }),
        queryClient.invalidateQueries({ queryKey: ['lowboy-iva'] }),
        queryClient.invalidateQueries({ queryKey: ['lowboy-missing-names', key] }),
      ]);
      toast.success(`${result.completados} completados, ${result.sinResultado} sin resultado.`);
    },
    onError: (error: Error) => {
      logger.error('Error en backfill de razones sociales', error);
      toast.error(error.message || 'No fue posible completar las razones sociales.');
    },
  });
}
