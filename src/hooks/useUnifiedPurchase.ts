import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UnifiedPurchaseService, UnifiedPurchaseData, UnifiedPurchaseResult } from '@/services/UnifiedPurchaseService';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useUniversalSync } from '@/hooks/useUniversalSync';

/**
 * Hook for unified inventory purchase operations
 * 
 * This is the primary hook for registering inventory purchases.
 * It ensures synchronization between Costs, Inventory (Bodega), and Cranes.
 * 
 * Usage:
 * ```tsx
 * const { registerPurchase, createConsumption, isPending } = useUnifiedPurchase();
 * 
 * // Register a new purchase
 * const result = await registerPurchase({
 *   itemName: 'Aceite Hidráulico',
 *   quantity: 10,
 *   unitCost: 5000,
 *   date: '2025-01-06',
 *   immediateConsumption: true,
 *   craneId: 'some-crane-id', // Optional: if provided, direct consumption
 * });
 * 
 * if (result.requiresDistribution) {
 *   // Open multi-crane distribution dialog
 * }
 * ```
 */
export const useUnifiedPurchase = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();

  const registerPurchaseMutation = useMutation({
    mutationFn: async (data: UnifiedPurchaseData): Promise<UnifiedPurchaseResult> => {
      return await UnifiedPurchaseService.registerPurchase(data);
    },
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate all related queries for synchronization
        invalidateAll();
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Registrar Compra',
      context: 'useUnifiedPurchase - registerPurchase',
    }),
  });

  const createConsumptionMutation = useMutation({
    mutationFn: async (params: {
      inventoryItemId: string;
      locationId: string;
      craneId: string;
      quantity: number;
      unitCost: number;
      date: string;
      itemName: string;
      costId?: string;
      supplierId?: string | null;
    }) => {
      return await UnifiedPurchaseService.createConsumption(params);
    },
    onSuccess: () => {
      // Invalidate all related queries
      invalidateAll();
    },
    onError: createMutationErrorHandler({
      title: 'Error al Registrar Consumo',
      context: 'useUnifiedPurchase - createConsumption',
    }),
  });

  return {
    // Register a new purchase (creates cost + entry movement + optional exit)
    registerPurchase: registerPurchaseMutation.mutateAsync,
    registerPurchaseSync: registerPurchaseMutation.mutate,
    
    // Create consumption from existing inventory
    createConsumption: createConsumptionMutation.mutateAsync,
    createConsumptionSync: createConsumptionMutation.mutate,
    
    // Loading states
    isPending: registerPurchaseMutation.isPending || createConsumptionMutation.isPending,
    isRegisteringPurchase: registerPurchaseMutation.isPending,
    isCreatingConsumption: createConsumptionMutation.isPending,
    
    // Error states
    registerPurchaseError: registerPurchaseMutation.error,
    createConsumptionError: createConsumptionMutation.error,
  };
};

/**
 * Hook to get purchase data for a specific cost
 */
export const usePurchaseDataForCost = (costId: string | null) => {
  // This could be extended to fetch related data
  return {
    costId,
  };
};
