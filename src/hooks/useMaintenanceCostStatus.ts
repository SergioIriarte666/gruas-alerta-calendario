import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceCostStatus {
  maintenanceId: string;
  hasCost: boolean;
  costId?: string;
  costAmount?: number;
  costDescription?: string;
  costDate?: string;
}

export const useMaintenanceCostStatus = (maintenanceIds: string[]) => {
  return useQuery({
    queryKey: ['maintenance-cost-status', maintenanceIds],
    queryFn: async (): Promise<MaintenanceCostStatus[]> => {
      if (maintenanceIds.length === 0) return [];

      // Check which maintenances have associated costs
      const { data, error } = await supabase
        .from('costs')
        .select('id, amount, description, date, maintenance_id')
        .in('maintenance_id', maintenanceIds)
        .not('maintenance_id', 'is', null);

      if (error) {
        console.error('Error fetching maintenance cost status:', error);
        throw error;
      }

      // Create a map of maintenance costs
      const costMap = new Map(data.map(cost => [cost.maintenance_id!, cost]));

      // Return status for each maintenance
      return maintenanceIds.map(id => ({
        maintenanceId: id,
        hasCost: costMap.has(id),
        costId: costMap.get(id)?.id,
        costAmount: costMap.get(id)?.amount,
        costDescription: costMap.get(id)?.description,
        costDate: costMap.get(id)?.date
      }));
    },
    enabled: maintenanceIds.length > 0
  });
};