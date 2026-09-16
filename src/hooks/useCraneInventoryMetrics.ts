import { parseDateValue } from '@/utils/calendarDate';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useCraneInventoryMetrics");

export interface CraneInventoryMetrics {
  // PIEZAS INSTALADAS (desde crane_parts directos)
  totalPartsInstalled: number;
  installedPartsValue: number;
  
  // CONSUMOS DE INVENTARIO (desde inventory_movements)
  totalInventoryConsumptions: number;
  consumptionValue: number;
  
  // MANTENIMIENTOS
  pendingMaintenanceAlerts: number;
  
  // MÉTRICAS UNIFICADAS
  totalValue: number;
  lastMovementDate: string | null;
  recentPurchases: number;
  
  // SINCRONIZACIÓN ESPECÍFICA DE ESTA GRÚA
  syncStatus: {
    totalParts: number;
    syncedParts: number;
    unsyncedParts: number;
    syncPercentage: number;
  };
}

interface UseCraneInventoryMetricsOptions {
  realtime?: boolean;
}

export const useCraneInventoryMetrics = (
  craneId: string,
  { realtime = true }: UseCraneInventoryMetricsOptions = {},
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!craneId || !realtime) return;
    const channel = supabase
      // Topic unico por montaje: este hook puede montarse en paralelo
      // (lista movil + modal de detalle) con el mismo craneId. Con topic
      // fijo, supabase-js reutiliza la instancia del canal y el segundo
      // .subscribe() lanza "tried to subscribe multiple times".
      .channel(`crane-inventory-metrics-${craneId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crane_parts', filter: `crane_id=eq.${craneId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics', craneId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements', filter: `crane_id=eq.${craneId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics', craneId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs', filter: `crane_id=eq.${craneId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics', craneId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [craneId, queryClient, realtime]);

  return useQuery({
    queryKey: ['crane-inventory-metrics', craneId],
    queryFn: async (): Promise<CraneInventoryMetrics> => {
      // 1. Obtener piezas instaladas directamente (crane_parts)
      const { data: installedPartsData, error: partsError } = await supabase
        .from('crane_parts')
        .select('total_value, date')
        .eq('crane_id', craneId)
        .is('inventory_movement_id', null); // Solo piezas directas

      if (partsError) {
        logger.error('[useCraneInventoryMetrics] Error cargando piezas instaladas:', partsError);
        throw partsError;
      }

      // 2. Obtener consumos de inventario (movimientos de salida)
      const { data: consumptionData, error: consumptionError } = await supabase
        .from('inventory_movements')
        .select('movement_date, total_cost, quantity')
        .eq('crane_id', craneId)
        .eq('movement_type', 'exit')
        .eq('status', 'active')
        .order('movement_date', { ascending: false });

      if (consumptionError) {
        logger.error('[useCraneInventoryMetrics] Error cargando consumos de inventario:', consumptionError);
        throw consumptionError;
      }

      // 3. Obtener alertas de mantenimiento pendientes
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('crane_maintenance')
        .select('id')
        .eq('crane_id', craneId)
        .eq('status', 'scheduled')
        .lte('scheduled_date', businessClock.today());

      if (maintenanceError) {
        logger.error('[useCraneInventoryMetrics] Error cargando alertas de mantenimiento:', maintenanceError);
        throw maintenanceError;
      }

      // CALCULAR MÉTRICAS SEPARADAS
      const totalPartsInstalled = installedPartsData?.length || 0;
      const installedPartsValue = installedPartsData?.reduce((sum, part) => sum + (part.total_value || 0), 0) || 0;

      const totalInventoryConsumptions = consumptionData?.length || 0;
      const consumptionValue = consumptionData?.reduce((sum, consumption) => sum + (consumption.total_cost || 0), 0) || 0;

      const thirtyDaysAgo = businessClock.todayDate();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentPurchases = installedPartsData?.filter(part => 
        parseDateValue(part.date) >= thirtyDaysAgo
      ).length || 0;

      const lastMovementDate = consumptionData?.[0]?.movement_date || null;
      const pendingMaintenanceAlerts = maintenanceData?.length || 0;

      // 4. Calcular estado de sincronización ESPECÍFICO de esta grúa
      const { data: allCraneParts } = await supabase
        .from('crane_parts')
        .select('id, inventory_movement_id')
        .eq('crane_id', craneId);

      const totalParts = allCraneParts?.length || 0;
      const syncedParts = allCraneParts?.filter(p => p.inventory_movement_id !== null).length || 0;
      const unsyncedParts = totalParts - syncedParts;
      const syncPercentage = totalParts > 0 ? Math.round((syncedParts / totalParts) * 100) : 100;

      return {
        // Piezas instaladas
        totalPartsInstalled,
        installedPartsValue,
        
        // Consumos de inventario
        totalInventoryConsumptions,
        consumptionValue,
        
        // Mantenimientos
        pendingMaintenanceAlerts,
        
        // Métricas unificadas
        totalValue: installedPartsValue + consumptionValue,
        lastMovementDate,
        recentPurchases,
        
        // Sincronización específica
        syncStatus: {
          totalParts,
          syncedParts,
          unsyncedParts,
          syncPercentage
        }
      };
    },
    enabled: !!craneId
  });
};
