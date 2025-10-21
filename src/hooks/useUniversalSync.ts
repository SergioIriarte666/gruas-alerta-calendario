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
    console.log('🔄 [UniversalSync] Invalidando todas las queries relacionadas...');
    
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
    
    // ========== SERVICIOS (por si hay comisiones o costos de servicio) ==========
    queryClient.invalidateQueries({ queryKey: ['services'] });
    
    console.log('✅ [UniversalSync] Todas las queries invalidadas correctamente');
  };

  /**
   * Invalida queries específicas de inventario
   */
  const invalidateInventory = () => {
    console.log('🔄 [UniversalSync] Invalidando queries de inventario...');
    
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
    
    console.log('✅ [UniversalSync] Queries de inventario invalidadas');
  };

  /**
   * Invalida queries específicas de costos
   */
  const invalidateCosts = () => {
    console.log('🔄 [UniversalSync] Invalidando queries de costos...');
    
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
    
    console.log('✅ [UniversalSync] Queries de costos invalidadas');
  };

  /**
   * Invalida queries específicas de piezas de grúas
   */
  const invalidateCraneParts = () => {
    console.log('🔄 [UniversalSync] Invalidando queries de piezas de grúas...');
    
    queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
    queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
    queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
    
    console.log('✅ [UniversalSync] Queries de piezas invalidadas');
  };

  /**
   * Refetch inmediato de queries críticas (usar después de invalidateAll)
   */
  const refetchCritical = async () => {
    console.log('🔄 [UniversalSync] Refetch inmediato de queries críticas...');
    
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['costs'] }),
      queryClient.refetchQueries({ queryKey: ['inventory-stock'] }),
      queryClient.refetchQueries({ queryKey: ['inventory-stats'] }),
    ]);
    
    console.log('✅ [UniversalSync] Refetch completado');
  };

  return { 
    invalidateAll, 
    invalidateInventory,
    invalidateCosts,
    invalidateCraneParts,
    refetchCritical 
  };
};
