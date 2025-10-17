import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useInventorySyncWatcher = (craneId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Canal para cambios en crane_parts
    const partsChannel = supabase
      .channel(`crane-parts-sync-${craneId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crane_parts',
          filter: craneId ? `crane_id=eq.${craneId}` : undefined
        },
        (payload) => {
          console.log('🔄 Real-time: Cambio en crane_parts', payload);
          queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
          queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-sync-stats'] });
          queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
        }
      )
      .subscribe();

    // Canal para cambios en inventory_movements
    const movementsChannel = supabase
      .channel(`inventory-movements-sync-${craneId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_movements',
          filter: craneId ? `crane_id=eq.${craneId}` : undefined
        },
        (payload) => {
          console.log('🔄 Real-time: Cambio en inventory_movements', payload);
          queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
          queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
        }
      )
      .subscribe();

    // Canal para cambios en inventory_items
    const itemsChannel = supabase
      .channel(`inventory-items-sync-${craneId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items'
        },
        (payload) => {
          console.log('🔄 Real-time: Cambio en inventory_items', payload);
          queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(partsChannel);
      supabase.removeChannel(movementsChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [craneId, queryClient]);
};
