import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useMaintenanceCostStatus");
interface MaintenanceCostStatus {
  maintenanceId: string;
  hasCost: boolean;
  costId?: string;
  costAmount?: number;
  costDescription?: string;
  costDate?: string;
  paymentDate?: string | null;
}

export const useMaintenanceCostStatus = (maintenanceIds: string[]) => {
  return useQuery({
    queryKey: ['maintenance-cost-status', maintenanceIds],
    queryFn: async (): Promise<MaintenanceCostStatus[]> => {
      if (maintenanceIds.length === 0) return [];

      const { data, error } = await supabase
        .from('costs')
        .select('id, amount, description, date, maintenance_id, payment_date')
        .in('maintenance_id', maintenanceIds)
        .not('maintenance_id', 'is', null);

      if (error) {
        logger.error('Error fetching maintenance cost status:', error);
        throw error;
      }

      const costMap = new Map(data.map(cost => [cost.maintenance_id!, cost]));

      return maintenanceIds.map(id => ({
        maintenanceId: id,
        hasCost: costMap.has(id),
        costId: costMap.get(id)?.id,
        costAmount: costMap.get(id)?.amount,
        costDescription: costMap.get(id)?.description,
        costDate: costMap.get(id)?.date,
        paymentDate: costMap.get(id)?.payment_date,
      }));
    },
    enabled: maintenanceIds.length > 0
  });
};

export const useToggleMaintenanceCostPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ costId, isPaid }: { costId: string; isPaid: boolean }) => {
      const { error } = await supabase
        .from('costs')
        .update({
          payment_date: isPaid ? getTodayLocal() : null,
        })
        .eq('id', costId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-cost-status'] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      toast.success('Estado de pago actualizado');
    },
    onError: (error: any) => {
      logger.error('Error toggling payment:', error);
      toast.error('Error al actualizar estado de pago');
    },
  });
};
