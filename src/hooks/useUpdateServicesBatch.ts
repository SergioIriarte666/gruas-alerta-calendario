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
  operatorId?: string | null;
}

export const useUpdateServicesBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceBatchUpdateData) => {
      const { serviceIds, fields, appendObservations, operatorId } = data;

      for (const serviceId of serviceIds) {
        const updateData: Record<string, unknown> = {};

        if (fields.status !== undefined) {
          updateData.status = fields.status;
        }

        if (fields.crane_id !== undefined) {
          updateData.crane_id = fields.crane_id || null;
        }

        if (fields.observations !== undefined) {
          if (appendObservations && fields.observations) {
            const { data: existing, error: fetchObsError } = await supabase
              .from('services')
              .select('observations')
              .eq('id', serviceId)
              .single();
            
            if (fetchObsError) {
              console.error('Error fetching observations:', fetchObsError);
            }
            
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
          const { data: existingResources, error: fetchError } = await supabase
            .from('service_resources')
            .select('id')
            .eq('service_id', serviceId)
            .eq('role', 'Principal')
            .limit(1);

          if (fetchError) {
            console.error('Error fetching service resources:', fetchError);
            throw new Error(`Error fetching operator data: ${fetchError.message}`);
          }

          if (existingResources && existingResources.length > 0) {
            if (operatorId) {
              // Update existing primary operator
              const { error: updateError } = await supabase
                .from('service_resources')
                .update({ operator_id: operatorId })
                .eq('id', existingResources[0].id);
              
              if (updateError) {
                console.error('Error updating operator:', updateError);
                throw new Error(`Error updating operator: ${updateError.message}`);
              }
            } else {
              // Remove operator assignment (operatorId is null)
              const { error: deleteError } = await supabase
                .from('service_resources')
                .delete()
                .eq('id', existingResources[0].id);
              
              if (deleteError) {
                console.error('Error removing operator:', deleteError);
                throw new Error(`Error removing operator: ${deleteError.message}`);
              }
            }
          } else if (operatorId) {
            // Create new primary operator assignment
            const { error: insertError } = await supabase
              .from('service_resources')
              .insert({
                service_id: serviceId,
                operator_id: operatorId,
                role: 'Principal',
                resource_type: 'operator'
              });
            
            if (insertError) {
              console.error('Error assigning operator:', insertError);
              throw new Error(`Error assigning operator: ${insertError.message}`);
            }
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