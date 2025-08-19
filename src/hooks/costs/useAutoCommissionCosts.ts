
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';

interface CreateCommissionCostParams {
  service: Service;
  commissionAmount: number;
}

// ⚠️ DEPRECATED: This hook is now disabled to prevent commission duplication
// Commissions are now handled exclusively through MultipleOperatorsSection
const createCommissionCost = async ({ service, commissionAmount }: CreateCommissionCostParams) => {
  console.warn('[useAutoCommissionCosts] DISABLED: Automatic commission cost creation is disabled to prevent duplication');
  console.warn('[useAutoCommissionCosts] Commissions should be managed through MultipleOperatorsSection');
  
  // Return early without creating cost to prevent duplication
  return null;
};

export const useAutoCommissionCosts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCommissionCost,
    onSuccess: (data, variables) => {
      console.log(`[useAutoCommissionCosts] DISABLED: Auto-commission creation bypassed for service ${variables.service.folio}`);
      // No longer invalidate costs or show success toast since we're not creating costs
    },
    onError: (error, variables) => {
      console.error(`[useAutoCommissionCosts] Commission creation disabled for service ${variables.service.folio}:`, error);
      // No longer show error toast since this is expected behavior
    },
  });
};

// New hook for migrating legacy commission costs (if needed in the future)
export const useMigrateCommissionCosts = () => {
  const queryClient = useQueryClient();

  const migrateCommissionCosts = async (serviceId: string) => {
    console.log('[useMigrateCommissionCosts] Starting migration of legacy commission costs for service:', serviceId);
    
    // Get commission category
    const { data: category, error: categoryError } = await supabase
      .from('cost_categories')
      .select('id')
      .eq('name', 'Comisión Operador')
      .single();

    if (categoryError || !category) {
      throw new Error('No se encontró la categoría "Comisión Operador"');
    }

    // Find legacy commission costs for this service
    const { data: commissionCosts, error: costsError } = await supabase
      .from('costs')
      .select('*')
      .eq('service_id', serviceId)
      .eq('category_id', category.id);

    if (costsError) {
      throw new Error('Error al buscar costos de comisión legacy');
    }

    if (commissionCosts && commissionCosts.length > 0) {
      console.log(`[useMigrateCommissionCosts] Found ${commissionCosts.length} legacy commission costs to migrate`);
      
      // Here you could implement migration logic if needed
      // For now, we just log the findings
      
      toast.info(
        "Costos de Comisión Legacy Detectados", 
        { description: `Se encontraron ${commissionCosts.length} costos de comisión que podrían necesitar migración` }
      );
    }

    return commissionCosts;
  };

  return useMutation({
    mutationFn: migrateCommissionCosts,
    onSuccess: (data) => {
      console.log('[useMigrateCommissionCosts] Migration check completed');
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
    onError: (error) => {
      console.error('[useMigrateCommissionCosts] Migration check failed:', error);
      toast.error("Error en Migración", { description: "No se pudo verificar costos de comisión legacy" });
    },
  });
};
