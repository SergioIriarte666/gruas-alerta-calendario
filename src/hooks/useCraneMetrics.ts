import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CraneMetrics {
  totalServices: number;
  completedServices: number;
  pendingServices: number;
  monthlyRevenue: number;
  maintenanceCosts: number;
  maintenanceCount: number;
  utilizationRate: number;
  efficiency: number;
}

export const useCraneMetrics = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-metrics', craneId],
    queryFn: async (): Promise<CraneMetrics> => {
      // Obtener métricas desde la función de base de datos
      const { data: metricsData, error } = await supabase
        .rpc('get_crane_metrics', { p_crane_id: craneId });

      if (error) {
        console.error('Error fetching crane metrics:', error);
        throw error;
      }

      // Parsear la respuesta JSON
      const metrics = metricsData as any;

      // Calcular métricas adicionales
      const utilizationRate = metrics.total_services > 0 
        ? Math.round((metrics.completed_services / metrics.total_services) * 100)
        : 0;

      const efficiency = metrics.total_services > 0
        ? Math.round(((metrics.total_services - metrics.pending_services) / metrics.total_services) * 100)
        : 0;

      return {
        totalServices: metrics.total_services || 0,
        completedServices: metrics.completed_services || 0,
        pendingServices: metrics.pending_services || 0,
        monthlyRevenue: metrics.monthly_revenue || 0,
        maintenanceCosts: metrics.maintenance_costs || 0,
        maintenanceCount: metrics.maintenance_count || 0,
        utilizationRate,
        efficiency
      };
    },
    enabled: !!craneId
  });
};