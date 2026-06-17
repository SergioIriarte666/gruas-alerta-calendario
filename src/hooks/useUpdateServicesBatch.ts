import { businessClock } from '@/utils/businessClock';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ServiceStatus } from '@/types';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useUpdateServicesBatch");
export interface BatchProgressCallback {
  current: number;
  total: number;
  percentage: number;
  currentItemId?: string;
}

export interface ServiceBatchUpdateData {
  serviceIds: string[];
  fields: {
    status?: ServiceStatus;
    crane_id?: string | null;
    observations?: string | null;
  };
  appendObservations?: boolean;
  operatorId?: string | null;
  onProgress?: (progress: BatchProgressCallback) => void;
}

export const useUpdateServicesBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceBatchUpdateData) => {
      const { serviceIds, fields, appendObservations, operatorId, onProgress } = data;
      const total = serviceIds.length;

      for (let index = 0; index < serviceIds.length; index++) {
        const serviceId = serviceIds[index];
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
              logger.error('Error fetching observations:', fetchObsError);
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

        // Update operator if specified
        // IMPORTANT: The Services page reads the legacy services.operator_id, so we must keep it in sync.
        if (operatorId !== undefined) {
          // 1) Update legacy field for immediate UI consistency
          const { error: legacyOperatorError } = await supabase
            .from('services')
            .update({ operator_id: operatorId || null })
            .eq('id', serviceId);

          if (legacyOperatorError) {
            throw new Error(`Error updating service operator: ${legacyOperatorError.message}`);
          }

          // 2) Sync primary operator in service_resources (unified multi-operator system)
          const { data: existingPrimaryResources, error: fetchError } = await supabase
            .from('service_resources')
            .select('id')
            .eq('service_id', serviceId)
            .eq('resource_type', 'operator')
            .or('is_primary.eq.true,role.eq.Principal')
            .order('is_primary', { ascending: false })
            .limit(1);

          if (fetchError) {
            logger.error('Error fetching service_resources primary operator:', fetchError);
            throw new Error(`Error fetching operator data: ${fetchError.message}`);
          }

          const existingPrimaryId = existingPrimaryResources?.[0]?.id;

          if (existingPrimaryId) {
            if (operatorId) {
              const { error: updateError } = await supabase
                .from('service_resources')
                .update({
                  operator_id: operatorId,
                  is_primary: true,
                  role: 'Principal',
                  updated_at: businessClock.nowISO(),
                })
                .eq('id', existingPrimaryId);

              if (updateError) {
                logger.error('Error updating primary operator resource:', updateError);
                throw new Error(`Error updating operator: ${updateError.message}`);
              }

              // Ensure no other operator resource remains marked as primary
              const { error: demoteError } = await supabase
                .from('service_resources')
                .update({ is_primary: false, updated_at: businessClock.nowISO() })
                .eq('service_id', serviceId)
                .eq('resource_type', 'operator')
                .neq('id', existingPrimaryId)
                .eq('is_primary', true);

              if (demoteError) {
                logger.error('Error demoting other primary operator resources:', demoteError);
              }
            } else {
              // Remove operator assignment (operatorId is null)
              const { error: deleteError } = await supabase
                .from('service_resources')
                .delete()
                .eq('id', existingPrimaryId);

              if (deleteError) {
                logger.error('Error removing operator resource:', deleteError);
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
                resource_type: 'operator',
                is_primary: true,
              });

            if (insertError) {
              logger.error('Error assigning operator:', insertError);
              throw new Error(`Error assigning operator: ${insertError.message}`);
            }
          }
        }

        // Report progress after each service
        onProgress?.({
          current: index + 1,
          total,
          percentage: ((index + 1) / total) * 100,
          currentItemId: serviceId,
        });
      }

      return { success: true, count: serviceIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(`${data.count} servicio${data.count > 1 ? 's' : ''} actualizado${data.count > 1 ? 's' : ''} exitosamente`);
    },
    onError: (error: Error) => {
      logger.error('Error updating services batch:', error);
      toast.error(`Error al actualizar servicios: ${error.message}`);
    },
  });
};