import { useQueryClient } from '@tanstack/react-query';

export const useCostInvalidation = () => {
  const queryClient = useQueryClient();

  const invalidateAllCostQueries = () => {
    console.log('🔄 Invalidating all cost-related queries...');
    
    // Invalidar queries principales
    queryClient.invalidateQueries({ queryKey: ['costs'] });
    queryClient.invalidateQueries({ queryKey: ['service-costs'] });
    queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
    
    // Forzar refetch inmediato de todas las queries relacionadas
    queryClient.refetchQueries({ queryKey: ['costs'] });
    queryClient.refetchQueries({ queryKey: ['service-costs'] });
    queryClient.refetchQueries({ queryKey: ['commissions'] });
    
    console.log('✅ Cost and commission queries invalidated and refetched');
  };

  return { invalidateAllCostQueries };
};