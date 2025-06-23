
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const useServiceStatusUpdate = (serviceId: string | undefined) => {
  const queryClient = useQueryClient();
  
  const updateServiceStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!id) {
        throw new Error('ID del servicio requerido');
      }
      
      console.log('🔄 [STATUS] Iniciando actualización para servicio:', id);
      
      // Verificar servicio actual
      const { data: currentService, error: fetchError } = await supabase
        .from('services')
        .select('id, status, folio')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ [STATUS] Error al obtener servicio:', fetchError);
        throw new Error(`Error al obtener servicio: ${fetchError.message}`);
      }

      if (!currentService) {
        console.error('❌ [STATUS] Servicio no encontrado:', id);
        throw new Error('Servicio no encontrado');
      }

      console.log('🔍 [STATUS] Servicio encontrado:', {
        id: currentService.id,
        folio: currentService.folio,
        statusActual: currentService.status
      });

      if (currentService.status === 'in_progress') {
        console.log('⚠️ [STATUS] Servicio ya en progreso');
        return currentService;
      }

      // Actualizar estado
      console.log('🔄 [STATUS] Actualizando a in_progress...');
      const { data: updatedService, error: updateError } = await supabase
        .from('services')
        .update({ status: 'in_progress' })
        .eq('id', id)
        .select('id, status, folio')
        .single();

      if (updateError) {
        console.error('❌ [STATUS] Error en actualización:', updateError);
        throw new Error(`Error al actualizar: ${updateError.message}`);
      }

      if (!updatedService) {
        throw new Error('No se pudo confirmar la actualización');
      }
      
      console.log('✅ [STATUS] Actualización exitosa:', {
        id: updatedService.id,
        folio: updatedService.folio,
        nuevoStatus: updatedService.status
      });

      return updatedService;
    },
    onSuccess: (updatedService) => {
      console.log('✅ [STATUS] Mutation exitosa:', updatedService);
      
      queryClient.invalidateQueries({ queryKey: ['operatorServices'] });
      queryClient.invalidateQueries({ queryKey: ['operatorService', serviceId] });
      
      toast.success(`Servicio ${updatedService.folio} iniciado con éxito`);
    },
    onError: (error) => {
      console.error('💥 [STATUS] Error en mutation:', error);
      toast.error(`Error al iniciar servicio: ${error.message}`);
    },
  });

  return { updateServiceStatusMutation };
};
