import { useQueryClient } from '@tanstack/react-query';
import { inventoryQueryKeys, invalidateStockDependentQueries } from '@/lib/queryKeys/inventory';

/**
 * FASE 5: Hook de Sincronización Universal
 * 
 * Hook centralizado para invalidar todas las queries relacionadas
 * cuando hay cambios en costos, inventario, piezas de grúas o proveedores.
 * 
 * Esto garantiza que toda la UI se actualice automáticamente sin importar
 * desde qué módulo se haga el cambio (Costos, Grúas, Proveedores, Inventario).
 */
export const useUniversalSync = () => {
  const queryClient = useQueryClient();

  /**
   * Invalida queries relacionadas según el tipo de cambio.
   * mode: 'costs-only' | 'with-inventory' | 'with-suppliers' | 'full'
   */
  const invalidateAll = (mode: 'costs-only' | 'with-inventory' | 'with-suppliers' | 'full' = 'costs-only') => {

    // Siempre invalidar costos
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });

    if (mode === 'with-inventory' || mode === 'full') {
      // Incluye el selector de productos de Servicios. Ver @/lib/queryKeys/inventory.
      invalidateStockDependentQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['crane-consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
    }

    if (mode === 'with-suppliers' || mode === 'full') {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice-items'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoice-details'] });
    }

    if (mode === 'full') {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    }
  };

  /**
   * Invalida queries específicas de inventario
   */
  const invalidateInventory = () => {
    invalidateStockDependentQueries(queryClient);
  };

  /**
   * Invalida queries específicas de costos
   */
  const invalidateCosts = () => {
    
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
  };

  /**
   * Invalida queries específicas de piezas de grúas
   */
  const invalidateCraneParts = () => {
    
    queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
    queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
    queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
    queryClient.invalidateQueries({ queryKey: ['crane-consumptions'] });
    queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics'] });
  };

  /**
   * Refetch inmediato de queries críticas (usar después de invalidateAll)
   */
  const refetchCritical = async () => {
    
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['costs'] }),
      queryClient.refetchQueries({ queryKey: inventoryQueryKeys.stock }),
      queryClient.refetchQueries({ queryKey: inventoryQueryKeys.stats }),
      queryClient.refetchQueries({ queryKey: inventoryQueryKeys.salesSelector }),
      queryClient.refetchQueries({ queryKey: ['supplier-invoices'] }),
      queryClient.refetchQueries({ queryKey: ['crane-consumptions'] }),
    ]);
  };

  return { 
    invalidateAll, 
    invalidateInventory,
    invalidateCosts,
    invalidateCraneParts,
    refetchCritical 
  };
};
