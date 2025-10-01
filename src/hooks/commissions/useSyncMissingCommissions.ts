import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  services_processed: number;
  commissions_created: number;
  message: string;
  error?: string;
}

export const useSyncMissingCommissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      console.log('🔄 [useSyncMissingCommissions] Iniciando sincronización de comisiones faltantes...');

      const { data, error } = await supabase.rpc('sync_missing_commissions');

      if (error) {
        console.error('❌ [useSyncMissingCommissions] Error:', error);
        throw error;
      }

      console.log('✅ [useSyncMissingCommissions] Resultado:', data);
      return data as unknown as SyncResult;
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      
      if (data.commissions_created > 0) {
        toast.success(
          "Sincronización Completada", 
          { 
            description: `Se crearon ${data.commissions_created} comisiones faltantes en ${data.services_processed} servicios.`,
            duration: 5000
          }
        );
      } else {
        toast.info(
          "Sin Comisiones Pendientes", 
          { 
            description: `Se revisaron ${data.services_processed} servicios. No hay comisiones faltantes.`,
            duration: 4000
          }
        );
      }
    },
    onError: (error: any) => {
      console.error('[useSyncMissingCommissions] Error:', error);
      toast.error(
        "Error en Sincronización", 
        { 
          description: error.message || "No se pudo sincronizar las comisiones faltantes",
          duration: 5000
        }
      );
    },
  });
};
