import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceStatus } from '@/types';

export interface ServiceBatchUpdateData {
  serviceIds: string[];
  fields: {
    status?: ServiceStatus;
    crane_id?: string | null;
    observations?: string | null;
  };
  appendObservations?: boolean;
  // For operator changes, we update service_resources table
  operatorId?: string | null;
}

export const useUpdateServicesBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceBatchUpdateData) => {
      const { serviceIds, fields, appendObservations, operatorId } = data;

      // Update each service
      for (const serviceId of serviceIds) {
        const updateData: any = {};

        if (fields.status !== undefined) {
          updateData.status = fields.status;
        }

        if (fields.crane_id !== undefined) {
          updateData.crane_id = fields.crane_id || null;
        }

        if (fields.observations !== undefined) {
          if (appendObservations && fields.observations) {
            // Fetch existing observations first
            const { data: existing } = await supabase
              .from('services')
              .select('observations')
              .eq('id', serviceId)
              .single();
            
            const existingObs = existing?.observations || '';
            updateData.observations = existingObs 
              ? `${existingObs}\n---\n${fields.observations}`
              : fields.observations;
          } else {
            updateData.observations = fields.observations;
          }
        }

        // Update service if there are fields to update
        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from('services')
            .update(updateData)
            .eq('id', serviceId);

          if (error) {
            throw new Error(`Error updating service: ${error.message}`);
          }
        }

        // Update operator if specified (update primary operator in service_resources)
        if (operatorId !== undefined) {
          // First, check if there's an existing primary operator
          const { data: existingResources } = await supabase
            .from('service_resources')
            .select('id')
            .eq('service_id', serviceId)
            .eq('role', 'primary')
            .limit(1);

          if (existingResources && existingResources.length > 0) {
            // Update existing primary operator
            if (operatorId) {
              await supabase
                .from('service_resources')
                .update({ operator_id: operatorId })
                .eq('id', existingResources[0].id);
            } else {
              // Remove operator assignment
              await supabase
                .from('service_resources')
                .delete()
                .eq('id', existingResources[0].id);
            }
          } else if (operatorId) {
            // Create new primary operator assignment
            await supabase
              .from('service_resources')
              .insert({
                service_id: serviceId,
                operator_id: operatorId,
                role: 'primary',
                resource_type: 'operator'
              });
          }
        }
      }

      return { success: true, count: serviceIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(`${data.count} servicio${data.count > 1 ? 's' : ''} actualizado${data.count > 1 ? 's' : ''} exitosamente`);
    },
    onError: (error: Error) => {
      console.error('Error updating services batch:', error);
      toast.error(`Error al actualizar servicios: ${error.message}`);
    },
  });
};
