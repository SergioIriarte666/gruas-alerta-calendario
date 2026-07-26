
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import { operatorServiceKeys, operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';

const logger = createLogger("useServiceStatusUpdate");
export const useServiceStatusUpdate = (serviceId: string | undefined) => {
  const queryClient = useQueryClient();
  
  const updateServiceStatusMutation = useMutation({
    mutationFn: async ({
      id,
      folioConfirmation,
      targetStatus = 'in_progress',
      startTime,
    }: {
      id: string;
      /**
       * El folio TAL COMO SE MUESTRA en la pantalla que dispara la acción. Es la
       * segunda llave: si el id que el flujo carga por dentro no corresponde a
       * ese folio, el servidor rechaza. Sin esto, un flujo con el servicio
       * equivocado cerró en producción un traslado real (25/07).
       */
      folioConfirmation: string;
      targetStatus?: 'in_progress' | 'inspection_completed' | 'completed';
      /** 'HH:mm' confirmado por el operador al iniciar. Se guarda junto al cambio de estado. */
      startTime?: string;
    }) => {
      if (!id) {
        throw new Error('ID del servicio requerido');
      }
      if (!folioConfirmation) {
        throw new Error('Falta el folio de confirmación del servicio');
      }

      logger.debug('🔄 [STATUS] Actualizando servicio', { id, folioConfirmation, targetStatus });

      // El estado se cambia SIEMPRE por RPC con doble llave (id + folio). El
      // UPDATE directo a services está bloqueado por trigger para el operador.
      const { error } = targetStatus === 'completed'
        ? await supabase.rpc('complete_service', {
            p_service_id: id,
            p_folio_confirmation: folioConfirmation,
          })
        : await supabase.rpc('advance_operator_service_status', {
            p_service_id: id,
            p_folio_confirmation: folioConfirmation,
            p_target_status: targetStatus,
            // start_time viaja en la MISMA llamada que el cambio a in_progress:
            // quedaba NULL porque nadie lo escribía al iniciar y la hora real de
            // partida se perdía.
            p_start_time: startTime ?? null,
          });

      if (error) {
        logger.error('❌ [STATUS] Error en actualización:', error);
        throw new Error(`Error al actualizar: ${error.message}`);
      }

      logger.debug('✅ [STATUS] Actualización exitosa:', { id, targetStatus });

      return { id, folio: folioConfirmation, status: targetStatus };
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
        toast.success(`Servicio ${updatedService.folio} iniciado - el seguimiento se enviará automáticamente`);
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
