import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CostCenter, CostCenterFormData, CostCenterWithStats } from '@/types/costCenters';
import { toast } from 'sonner';

const fetchCostCenters = async (): Promise<CostCenter[]> => {
  const { data, error } = await supabase
    .from('cost_centers')
    .select(`
      *,
      parent:parent_id(*)
    `)
    .order('code');

  if (error) {
    console.error('Error fetching cost centers:', error);
    throw new Error(error.message);
  }

  return data || [];
};

const fetchCostCentersWithStats = async (): Promise<CostCenterWithStats[]> => {
  // First get cost centers
  const { data: centers, error: centersError } = await supabase
    .from('cost_centers')
    .select(`
      *,
      parent:parent_id(*)
    `)
    .order('code');

  if (centersError) {
    console.error('Error fetching cost centers:', centersError);
    throw new Error(centersError.message);
  }

  // Then get aggregated cost stats efficiently
  const { data: costStats, error: statsError } = await supabase
    .from('costs')
    .select('cost_center_id, amount')
    .not('cost_center_id', 'is', null);

  if (statsError) {
    console.error('Error fetching cost stats:', statsError);
    throw new Error(statsError.message);
  }

  // Aggregate costs by cost center
  const costsByCenter = (costStats || []).reduce((acc, cost) => {
    const centerId = cost.cost_center_id;
    if (!acc[centerId]) {
      acc[centerId] = { total: 0, count: 0 };
    }
    acc[centerId].total += Number(cost.amount || 0);
    acc[centerId].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  return (centers || []).map(center => {
    const stats = costsByCenter[center.id] || { total: 0, count: 0 };
    const budget_used_percentage = center.budget_amount ? (stats.total / Number(center.budget_amount)) * 100 : 0;

    return {
      ...center,
      total_costs: stats.total,
      cost_count: stats.count,
      budget_used_percentage
    };
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
    console.error('Error adding cost center:', error);
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
    console.error('Error updating cost center:', error);
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
    console.error('Error deleting cost center:', error);
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