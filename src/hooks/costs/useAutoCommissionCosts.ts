
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useAutoCommissionCosts");
interface CreateCommissionCostParams {
  service: Service;
  commissionAmount: number;
}

// ✅ RESTAURADO: Sistema original de comisiones automáticas
// Las comisiones se crean automáticamente por el trigger de BD al completar servicios
const createCommissionCost = async ({ service, commissionAmount }: CreateCommissionCostParams) => {
  logger.debug('[useAutoCommissionCosts] RESTAURADO: Sistema automático de comisiones habilitado');
  logger.debug('[useAutoCommissionCosts] Las comisiones se crean automáticamente por trigger de BD');
  
  // El trigger de BD se encarga de crear las comisiones, este hook solo es para compatibilidad
  return { success: true, message: 'Las comisiones se crean automáticamente por trigger de BD' };
};

export const useAutoCommissionCosts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCommissionCost,
    onSuccess: (data, variables) => {
      logger.debug(`[useAutoCommissionCosts] DISABLED: Auto-commission creation bypassed for service ${variables.service.folio}`);
      // No longer invalidate costs or show success toast since we're not creating costs
    },
    onError: (error, variables) => {
      logger.error(`[useAutoCommissionCosts] Commission creation disabled for service ${variables.service.folio}:`, error);
      // No longer show error toast since this is expected behavior
    },
  });
};

// New hook for migrating legacy commission costs (if needed in the future)
export const useMigrateCommissionCosts = () => {
  const queryClient = useQueryClient();

  const migrateCommissionCosts = async (serviceId: string) => {
    logger.debug('[useMigrateCommissionCosts] Starting migration of legacy commission costs for service:', serviceId);
    
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
      logger.debug(`[useMigrateCommissionCosts] Found ${commissionCosts.length} legacy commission costs to migrate`);
      
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
      logger.debug('[useMigrateCommissionCosts] Migration check completed');
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
    onError: (error) => {
      logger.error('[useMigrateCommissionCosts] Migration check failed:', error);
      toast.error("Error en Migración", { description: "No se pudo verificar costos de comisión legacy" });
    },
  });
};
