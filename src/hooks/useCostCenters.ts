import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CostCenter, CostCenterFormData, CostCenterWithStats } from '@/types/costCenters';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCostCenters");
const fetchCostCenters = async (): Promise<CostCenter[]> => {
  const { data, error } = await supabase
    .from('cost_centers')
    .select(`
      *,
      parent:parent_id(*)
    `)
    .order('code');

  if (error) {
    logger.error('Error fetching cost centers:', error);
    throw new Error(error.message);
  }

  return data || [];
};

const fetchCostCentersWithStats = async (): Promise<CostCenterWithStats[]> => {
  const { data: centers, error: centersError } = await supabase
    .from('cost_centers')
    .select('*, parent:parent_id(*)')
    .order('code');

  if (centersError) throw new Error(centersError.message);

  const now = new Date();

  const periodStart = (period: string | null): string => {
    switch (period) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      case 'quarterly': {
        const q = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
      }
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    }
  };

  // Traer costos del año en curso para cubrir todos los períodos posibles
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

  const { data: costStats, error: statsError } = await supabase
    .from('costs')
    .select('cost_center_id, amount, date')
    .not('cost_center_id', 'is', null)
    .gte('date', yearStart);

  if (statsError) throw new Error(statsError.message);

  return (centers || []).map(center => {
    const start = periodStart(center.budget_period);

    const periodCosts = (costStats || []).filter(cost =>
      cost.cost_center_id === center.id &&
      (cost.date || '') >= start
    );

    const total_costs = periodCosts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const cost_count = periodCosts.length;
    const budget_used_percentage = center.budget_amount
      ? (total_costs / Number(center.budget_amount)) * 100
      : 0;

    return { ...center, total_costs, cost_count, budget_used_percentage };
  });
};

export const useCostCenters = () => {
  return useQuery({
    queryKey: ['cost-centers'],
    queryFn: fetchCostCenters,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};

export const useCostCentersWithStats = () => {
  return useQuery({
    queryKey: ['cost-centers-stats'],
    queryFn: fetchCostCentersWithStats,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};

const addCostCenter = async (costCenterData: CostCenterFormData) => {
  const { data, error } = await supabase
    .from('cost_centers')
    .insert([costCenterData])
    .select()
    .single();

  if (error) {
    logger.error('Error adding cost center:', error);
    throw new Error(error.message);
  }
  
  return data;
};

export const useAddCostCenter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addCostCenter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      toast.success('Centro de costo creado exitosamente');
    },
    onError: (error) => {
      toast.error(`Error al crear centro de costo: ${error.message}`);
    },
  });
};

const updateCostCenter = async ({ id, ...costCenterData }: { id: string } & Partial<CostCenterFormData>) => {
  const { data, error } = await supabase
    .from('cost_centers')
    .update(costCenterData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating cost center:', error);
    throw new Error(error.message);
  }
  
  return data;
};

export const useUpdateCostCenter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCostCenter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      toast.success('Centro de costo actualizado exitosamente');
    },
    onError: (error) => {
      toast.error(`Error al actualizar centro de costo: ${error.message}`);
    },
  });
};

const deleteCostCenter = async (id: string) => {
  const { error } = await supabase
    .from('cost_centers')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting cost center:', error);
    throw new Error(error.message);
  }
};

export const useDeleteCostCenter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCostCenter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      toast.success('Centro de costo eliminado exitosamente');
    },
    onError: (error) => {
      toast.error(`Error al eliminar centro de costo: ${error.message}`);
    },
  });
};