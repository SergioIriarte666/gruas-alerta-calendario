import { useQueryClient } from '@tanstack/react-query';

export const useCostInvalidation = () => {
  const queryClient = useQueryClient();

  const invalidateAllCostQueries = () => {
    console.log('🔄 Invalidating all cost-related queries...');
    
    // Costos
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
    
    // Proveedores (sync triangular)
    queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
    
    // Grúas (piezas)
    queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
    
    // Inventario
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    
    // Forzar refetch inmediato
    queryClient.refetchQueries({ queryKey: ['costs'] });
    queryClient.refetchQueries({ queryKey: ['service-costs'] });
    queryClient.refetchQueries({ queryKey: ['commissions'] });
    
    console.log('✅ All triangular sync queries invalidated');
  };

  return { invalidateAllCostQueries };
};