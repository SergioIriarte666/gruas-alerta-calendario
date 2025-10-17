import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type CranePart = Database['public']['Tables']['crane_parts']['Row'];
export type CreateCranePartData = Database['public']['Tables']['crane_parts']['Insert'];
export type UpdateCranePartData = Database['public']['Tables']['crane_parts']['Update'];

// Tipo extendido para incluir información de origen
export type EnhancedCranePart = CranePart & {
  origin: 'direct' | 'cost' | 'consumption';
  cost_description?: string;
  consumption_details?: {
    inventory_item_name: string;
    movement_date: string;
    observations?: string;
    reference_document?: string;
    operator_name?: string;
  };
};

// Hook to fetch crane parts for a specific crane
export const useCraneParts = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-parts', craneId],
    queryFn: async () => {
      // Obtener piezas directas (creadas en crane_parts)
      const { data: directParts, error: directError } = await supabase
        .from('crane_parts')
        .select('*')
        .eq('crane_id', craneId)
        .order('date', { ascending: false });

      if (directError) throw directError;

      // Obtener IDs de costos que ya están vinculados en crane_parts
      const linkedCostIds = (directParts || [])
        .map(part => part.cost_id)
        .filter(id => id !== null);

      // Obtener piezas que vienen de costos de mantenimiento NO vinculados
      let costPartsQuery = supabase
        .from('costs')
        .select(`
          *,
          cost_categories (*)
        `)
        .eq('crane_id', craneId)
        .eq('subcategory', 'Piezas y Repuestos')
        .order('date', { ascending: false });

      // Excluir costos que ya están vinculados en crane_parts
      if (linkedCostIds.length > 0) {
        costPartsQuery = costPartsQuery.not('id', 'in', `(${linkedCostIds.join(',')})`);
      }

      const { data: costParts, error: costError } = await costPartsQuery;

      if (costError) throw costError;

      // Obtener IDs de movimientos de inventario que ya están vinculados en crane_parts
      const linkedMovementIds = (directParts || [])
        .map(part => part.inventory_movement_id)
        .filter(id => id !== null);

      // Obtener consumos de inventario (movimientos de salida para esta grúa)
      // EXCLUYENDO aquellos que ya están vinculados a un registro de crane_parts
      let consumptionQuery = supabase
        .from('inventory_movements')
        .select(`
          *,
          inventory_items (
            name,
            unit_of_measure
          ),
          operators (
            name
          )
        `)
        .eq('crane_id', craneId)
        .eq('movement_type', 'exit')
        .eq('status', 'active')
        .order('movement_date', { ascending: false });

      // Excluir movimientos que ya están vinculados en crane_parts
      if (linkedMovementIds.length > 0) {
        consumptionQuery = consumptionQuery.not('id', 'in', `(${linkedMovementIds.join(',')})`);
      }

      const { data: inventoryConsumptions, error: consumptionError } = await consumptionQuery;

      if (consumptionError) throw consumptionError;

      // Convertir costos huérfanos a formato de piezas
      const costBasedParts: EnhancedCranePart[] = (costParts || []).map(cost => ({
        id: `cost-${cost.id}`, // Prefijo para evitar conflictos de ID
        crane_id: cost.crane_id!,
        cost_id: cost.id,
        part_name: cost.description || 'Pieza sin nombre',
        supplier: 'Ver costo de mantenimiento',
        phone: null,
        quantity: 1,
        unit_price: cost.amount,
        total_value: cost.amount,
        date: cost.date,
        notes: cost.notes,
        kilometraje: null,
        inventory_movement_id: cost.inventory_movement_id,
        created_at: cost.created_at,
        updated_at: cost.updated_at,
        created_by: cost.created_by,
        origin: 'cost' as const,
        cost_description: cost.description,
      }));

      // Convertir consumos de inventario a formato de piezas
      const consumptionBasedParts: EnhancedCranePart[] = (inventoryConsumptions || []).map(consumption => ({
        id: `consumption-${consumption.id}`, // Prefijo para evitar conflictos de ID
        crane_id: consumption.crane_id!,
        cost_id: null,
        part_name: (consumption.inventory_items as any)?.name || 'Producto de inventario',
        supplier: 'Consumo de inventario',
        phone: null,
        quantity: consumption.quantity, // ✅ Positivo tal como está en BD
        unit_price: consumption.unit_cost || 0,
        total_value: consumption.total_cost || (consumption.unit_cost * consumption.quantity) || 0, // ✅ Positivo
        date: consumption.movement_date.split('T')[0], // Convertir timestamp a date
        notes: consumption.observations,
        kilometraje: null,
        inventory_movement_id: consumption.id,
        created_at: consumption.created_at,
        updated_at: consumption.created_at,
        created_by: consumption.created_by,
        origin: 'consumption' as const,
        consumption_details: {
          inventory_item_name: (consumption.inventory_items as any)?.name || 'Producto desconocido',
          movement_date: consumption.movement_date,
          observations: consumption.observations,
          reference_document: consumption.reference_document,
          operator_name: (consumption.operators as any)?.name,
        },
      }));

      // Marcar piezas directas
      const enhancedDirectParts: EnhancedCranePart[] = (directParts || []).map(part => ({
        ...part,
        origin: 'direct' as const,
      }));

      // Combinar todas las listas y ordenar por fecha
      const allParts = [...enhancedDirectParts, ...costBasedParts, ...consumptionBasedParts]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return allParts;
    },
    enabled: !!craneId,
  });
};

// Hook to create a new crane part
export const useCreateCranePart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCranePartData) => {
      const { data: result, error } = await supabase
        .from('crane_parts')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-parts', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('La pieza ha sido registrada exitosamente y se creó el costo asociado.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'No se pudo agregar la pieza');
    },
  });
};

// Hook to update a crane part
export const useUpdateCranePart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateCranePartData) => {
      const { data: result, error } = await supabase
        .from('crane_parts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-parts', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics', data.crane_id] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('La pieza ha sido actualizada exitosamente.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'No se pudo actualizar la pieza');
    },
  });
};

// Hook to delete a crane part
export const useDeleteCranePart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crane_parts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (_, id) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('La pieza y su costo asociado han sido eliminados exitosamente.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'No se pudo eliminar la pieza');
    },
  });
};

// Hook to get crane parts statistics
export const useCranePartsStats = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-parts-stats', craneId],
    queryFn: async () => {
      // Get direct parts data
      const { data: directParts, error: directPartsError } = await supabase
        .from('crane_parts')
        .select('*')
        .eq('crane_id', craneId);

      if (directPartsError) throw directPartsError;

      // Get parts from costs (maintenance category with subcategory "Piezas y Repuestos")
      const { data: costParts, error: costPartsError } = await supabase
        .from('costs')
        .select(`
          *,
          cost_categories!inner(name)
        `)
        .eq('crane_id', craneId)
        .eq('subcategory', 'Piezas y Repuestos');

      if (costPartsError) throw costPartsError;

      // Get inventory consumptions
      const { data: consumptions, error: consumptionsError } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('crane_id', craneId)
        .eq('movement_type', 'exit')
        .eq('status', 'active');

      if (consumptionsError) throw consumptionsError;

      // Combine all sources for total calculations
      const totalDirectParts = directParts?.length || 0;
      const totalCostParts = costParts?.length || 0;
      const totalConsumptions = consumptions?.length || 0;
      const totalParts = totalDirectParts + totalCostParts + totalConsumptions;

      const directPartsValue = directParts?.reduce((sum, part) => sum + (part.total_value || 0), 0) || 0;
      const costPartsValue = costParts?.reduce((sum, cost) => sum + (cost.amount || 0), 0) || 0;
      const consumptionsValue = consumptions?.reduce((sum, consumption) => sum + (consumption.total_cost || 0), 0) || 0;
      const totalValue = directPartsValue + costPartsValue + consumptionsValue;

      // Count unique suppliers from all sources
      const directSuppliers = directParts?.map(part => part.supplier) || [];
      const costSuppliers = costParts?.map(cost => cost.description || 'Sin proveedor') || [];
      const consumptionSuppliers = ['Inventario interno']; // Since consumptions come from internal inventory
      const uniqueSuppliers = new Set([...directSuppliers, ...costSuppliers, ...consumptionSuppliers]).size;
      
      // Get recent parts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentDirectParts = directParts?.filter(part => 
        new Date(part.date) >= thirtyDaysAgo
      ) || [];

      const recentCostParts = costParts?.filter(cost => 
        new Date(cost.date) >= thirtyDaysAgo
      ) || [];

      const recentConsumptions = consumptions?.filter(consumption => 
        new Date(consumption.movement_date) >= thirtyDaysAgo
      ) || [];

      const recentParts = recentDirectParts.length + recentCostParts.length + recentConsumptions.length;

      // Separar compras y consumos para balance correcto
      const totalPurchases = directPartsValue + costPartsValue; // Solo entradas
      const totalConsumed = consumptionsValue; // Total consumido
      const netValue = totalPurchases - totalConsumed; // Balance neto

      return {
        totalParts,
        totalValue: totalPurchases, // Solo compras
        totalConsumed, // Consumos
        netValue, // Balance neto
        uniqueSuppliers,
        recentParts
      };
    },
    enabled: !!craneId,
  });
};
