
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CraneInventoryMetrics {
  totalParts: number;
  totalValue: number;
  recentPurchases: number;
  lowStockAlerts: number;
  lastMovementDate: string | null;
  monthlySpending: number;
  pendingMaintenanceAlerts: number;
}

export const useCraneInventoryMetrics = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-inventory-metrics', craneId],
    queryFn: async (): Promise<CraneInventoryMetrics> => {
      // Obtener total de piezas registradas para la grúa
      const { data: partsData, error: partsError } = await supabase
        .from('crane_parts')
        .select('total_value, date')
        .eq('crane_id', craneId);

      if (partsError) throw partsError;

      // Obtener alertas de mantenimiento pendientes
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('crane_maintenance')
        .select('id')
        .eq('crane_id', craneId)
        .eq('status', 'scheduled')
        .lte('scheduled_date', new Date().toISOString());

      if (maintenanceError) throw maintenanceError;

      // Obtener movimientos de inventario relacionados con la grúa
      const { data: movementsData, error: movementsError } = await supabase
        .from('inventory_movements')
        .select('movement_date, total_cost, movement_type')
        .eq('crane_id', craneId)
        .eq('status', 'active')
        .order('movement_date', { ascending: false });

      if (movementsError) throw movementsError;

      // Calcular métricas
      const totalParts = partsData?.length || 0;
      const totalValue = partsData?.reduce((sum, part) => sum + (part.total_value || 0), 0) || 0;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentPurchases = partsData?.filter(part => 
        new Date(part.date) >= thirtyDaysAgo
      ).length || 0;

      const monthlySpending = movementsData?.filter(movement => 
        movement.movement_type === 'entry' && 
        new Date(movement.movement_date) >= thirtyDaysAgo
      ).reduce((sum, movement) => sum + (movement.total_cost || 0), 0) || 0;

      const lastMovementDate = movementsData?.[0]?.movement_date || null;
      const pendingMaintenanceAlerts = maintenanceData?.length || 0;

      return {
        totalParts,
        totalValue,
        recentPurchases,
        lowStockAlerts: 0, // Esta se puede implementar más adelante con alertas específicas
        lastMovementDate,
        monthlySpending,
        pendingMaintenanceAlerts
      };
    },
    enabled: !!craneId
  });
};
