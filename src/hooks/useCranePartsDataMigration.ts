
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MigrationResult {
  success: boolean;
  migrated_records: number;
  message: string;
}

interface DuplicateResult {
  success: boolean;
  duplicate_count: number;
  total_parts: number;
  total_costs: number;
  linked_costs: number;
  unlinked_costs: number;
  message: string;
}

export const useMigrateLegacyCranePartsData = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (craneId?: string) => {
      const { data, error } = await supabase.rpc('migrate_legacy_crane_parts_data' as any, {
        p_crane_id: craneId || null
      });

      if (error) throw error;
      return data as MigrationResult;
    },
    onSuccess: (data, craneId) => {
      if (craneId) {
        queryClient.invalidateQueries({ queryKey: ['crane-parts', craneId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      }
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success(`Migración completada. ${data?.migrated_records || 0} registros procesados.`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error durante la migración de datos');
    },
  });
};

export const useDetectDuplicateParts = () => {
  return useMutation({
    mutationFn: async (craneId?: string) => {
      const { data, error } = await supabase.rpc('detect_duplicate_crane_parts' as any, {
        p_crane_id: craneId || null
      });

      if (error) throw error;
      return data as DuplicateResult;
    },
    onSuccess: (data) => {
      const duplicateCount = data?.duplicate_count || 0;
      if (duplicateCount > 0) {
        toast.warning(`Se detectaron ${duplicateCount} posibles duplicados. Revise los datos.`);
      } else {
        toast.success('No se detectaron duplicados en los datos.');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al detectar duplicados');
    },
  });
};
