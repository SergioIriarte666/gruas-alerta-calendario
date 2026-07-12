
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import { operatorServiceKeys, operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';

const notifyTrackingLink = (serviceId: string) => {
  supabase.functions.invoke('send-whatsapp-tracking', { body: { service_id: serviceId } }).catch((error) => {
    logger.warn('No se pudo disparar el envio automatico del link de seguimiento', error);
  });
};


const logger = createLogger("useServiceStatusUpdate");
export const useServiceStatusUpdate = (serviceId: string | undefined) => {
  const queryClient = useQueryClient();
  
  const updateServiceStatusMutation = useMutation({
    mutationFn: async ({ id, targetStatus = 'in_progress' }: { id: string; targetStatus?: 'in_progress' | 'inspection_completed' | 'completed' }) => {
      if (!id) {
        throw new Error('ID del servicio requerido');
      }
      
      logger.debug('🔄 [STATUS] Iniciando actualización para servicio:', id);
      
      // Verificar servicio actual
      const { data: currentService, error: fetchError } = await supabase
        .from('services')
        .select('id, status, folio')
        .eq('id', id)
        .single();

      if (fetchError) {
        logger.error('❌ [STATUS] Error al obtener servicio:', fetchError);
        throw new Error(`Error al obtener servicio: ${fetchError.message}`);
      }

      if (!currentService) {
        logger.error('❌ [STATUS] Servicio no encontrado:', id);
        throw new Error('Servicio no encontrado');
      }

      logger.debug('🔍 [STATUS] Servicio encontrado:', {
        id: currentService.id,
        folio: currentService.folio,
        statusActual: currentService.status
      });

      // Verificar si ya está en el estado objetivo
      if (currentService.status === targetStatus) {
        logger.debug(`⚠️ [STATUS] Servicio ya en estado ${targetStatus}`);
        return currentService;
      }

      // Actualizar estado
      logger.debug(`🔄 [STATUS] Actualizando a ${targetStatus}...`);
      const { data: updatedService, error: updateError } = await supabase
        .from('services')
        .update({ status: targetStatus })
        .eq('id', id)
        .select('id, status, folio')
        .single();

      if (updateError) {
        logger.error('❌ [STATUS] Error en actualización:', updateError);
        throw new Error(`Error al actualizar: ${updateError.message}`);
      }

      if (!updatedService) {
        throw new Error('No se pudo confirmar la actualización');
      }
      
      logger.debug('✅ [STATUS] Actualización exitosa:', {
        id: updatedService.id,
        folio: updatedService.folio,
        nuevoStatus: updatedService.status
      });

      return updatedService;
    },
    onSuccess: async (updatedService) => {
      logger.debug('✅ [STATUS] Mutation exitosa:', updatedService);
      
      // Invalidar múltiples queries para asegurar sincronización
      const invalidationPromises = [
        queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
        queryClient.invalidateQueries({ queryKey: operatorServiceKeys.all }),
      ];
      
      // Si tenemos serviceId específico, también invalidar esa query
      if (serviceId) {
        invalidationPromises.push(
          queryClient.invalidateQueries({ queryKey: operatorServiceKeys.detail(serviceId) })
        );
      }
      
      await Promise.all(invalidationPromises);
      
      // Toast específico según el estado
      if (updatedService.status === 'in_progress') {
        toast.success(`Servicio ${updatedService.folio} iniciado con éxito`);
        notifyTrackingLink(updatedService.id);
      } else if (updatedService.status === 'inspection_completed') {
        toast.success(`Servicio ${updatedService.folio} listo para entrega`);
      } else if (updatedService.status === 'completed') {
        toast.success(`Servicio ${updatedService.folio} completado exitosamente`);
      }
    },
    onError: (error) => {
      logger.error('💥 [STATUS] Error en mutation:', error);
      toast.error(`Error al actualizar servicio: ${error.message}`);
    },
  });

  return { updateServiceStatusMutation };
};
