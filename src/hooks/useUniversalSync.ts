import { useQueryClient } from '@tanstack/react-query';

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
   * Invalida TODAS las queries relacionadas con el sistema de compras/inventario
   */
  const invalidateAll = () => {
    
    // ========== COSTOS ==========
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
    
    // ========== INVENTARIO ==========
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
    
    // ========== PIEZAS DE GRÚAS ==========
    queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
    queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
    queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
    
    // ========== PROVEEDORES ==========
    queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
    queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
    
    // ========== SERVICIOS (por si hay comisiones o costos de servicio) ==========
    queryClient.invalidateQueries({ queryKey: ['services'] });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  /**
   * Invalida queries específicas de inventario
   */
  const invalidateInventory = () => {
    
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
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
  };

  /**
   * Refetch inmediato de queries críticas (usar después de invalidateAll)
   */
  const refetchCritical = async () => {
    
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['costs'] }),
      queryClient.refetchQueries({ queryKey: ['inventory-stock'] }),
      queryClient.refetchQueries({ queryKey: ['inventory-stats'] }),
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
