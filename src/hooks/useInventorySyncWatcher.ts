import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useInventorySyncWatcher");
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
          logger.debug('🔄 Real-time: Cambio en crane_parts', payload);
          queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
          queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
          queryClient.invalidateQueries({ queryKey: ['crane-consumptions'] });
          queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
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
          logger.debug('🔄 Real-time: Cambio en inventory_movements', payload);
          queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
          queryClient.invalidateQueries({ queryKey: ['crane-consumptions'] });
          queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
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
          logger.debug('🔄 Real-time: Cambio en inventory_items', payload);
          queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
        }
      )
      .subscribe();

    const supplierInvoicesChannel = supabase
      .channel(`supplier-invoices-sync-${craneId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_invoices'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
          queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
          queryClient.invalidateQueries({ queryKey: ['costs'] });
        }
      )
      .subscribe();

    const supplierInvoiceItemsChannel = supabase
      .channel(`supplier-invoice-items-sync-${craneId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_invoice_items'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['purchase-invoice-items'] });
          queryClient.invalidateQueries({ queryKey: ['supplier-invoice-details'] });
          queryClient.invalidateQueries({ queryKey: ['costs'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(partsChannel);
      supabase.removeChannel(movementsChannel);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(supplierInvoicesChannel);
      supabase.removeChannel(supplierInvoiceItemsChannel);
    };
  }, [craneId, queryClient]);
};
