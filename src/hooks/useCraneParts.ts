import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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

const CRANE_PARTS_SELECT = `
  id,
  crane_id,
  cost_id,
  inventory_movement_id,
  part_name,
  supplier,
  supplier_id,
  phone,
  quantity,
  unit_price,
  total_value,
  date,
  notes,
  kilometraje,
  created_at,
  updated_at,
  created_by
`;

const COST_PARTS_SELECT = `
  id,
  crane_id,
  date,
  description,
  notes,
  amount,
  inventory_movement_id,
  created_at,
  updated_at,
  created_by
`;

const INVENTORY_CONSUMPTION_SELECT = `
  id,
  crane_id,
  movement_date,
  movement_type,
  status,
  quantity,
  unit_cost,
  total_cost,
  observations,
  reference_document,
  created_at,
  created_by,
  inventory_items (
    name,
    unit_of_measure
  ),
  operators (
    name
  )
`;

// Hook to fetch crane parts for a specific crane
export const useCraneParts = (craneId: string, options?: { source?: 'direct' | 'combined' }) => {
  const queryClient = useQueryClient();
  const sourceMode = options?.source ?? 'direct';

  useEffect(() => {
    if (!craneId) return;
    const channel = supabase
      .channel(`crane-parts-sync-${craneId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crane_parts', filter: `crane_id=eq.${craneId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-parts', craneId] });
        queryClient.invalidateQueries({ queryKey: ['crane-metrics', craneId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs', filter: `crane_id=eq.${craneId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-parts', craneId] });
        queryClient.invalidateQueries({ queryKey: ['crane-metrics', craneId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements', filter: `crane_id=eq.${craneId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-parts', craneId] });
        queryClient.invalidateQueries({ queryKey: ['crane-metrics', craneId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [craneId, queryClient]);

  return useQuery({
    queryKey: ['crane-parts', craneId],
    queryFn: async () => {
      // Obtener piezas directas (creadas en crane_parts)
      const { data: directPartsRaw, error: directError } = await supabase
        .from('crane_parts')
        .select(CRANE_PARTS_SELECT)
        .eq('crane_id', craneId)
        .order('date', { ascending: false });

      if (directError) throw directError;

      // Mapear IDs referenciados por piezas directas
      const referencedMovementIds = (directPartsRaw || [])
        .map(p => p.inventory_movement_id)
        .filter((v): v is string => !!v);
      const referencedCostIds = (directPartsRaw || [])
        .map(p => p.cost_id)
        .filter((v): v is string => !!v);

      // Consultar existencias actuales para evitar mostrar huérfanos
      const [activeMovementsResp, existingCostsResp] = await Promise.all([
        referencedMovementIds.length > 0
          ? supabase
              .from('inventory_movements')
              .select('id, movement_type, quantity, unit_cost, total_cost, movement_date, status')
              .in('id', referencedMovementIds)
              .eq('status', 'active')
          : Promise.resolve({ data: [] as { id: string }[] } as any),
        referencedCostIds.length > 0
          ? supabase
              .from('costs')
              .select('id')
              .in('id', referencedCostIds)
          : Promise.resolve({ data: [] as { id: string }[] } as any),
      ]);

      const activeMovements = ((activeMovementsResp as any).data || []) as Array<{
        id: string;
        movement_type: string;
        quantity: number | null;
        unit_cost: number | null;
        total_cost: number | null;
        movement_date: string | null;
        status: string;
      }>;

      const activeMovementIds = new Set(activeMovements.map(m => m.id));
      const movementById = new Map(activeMovements.map(m => [m.id, m] as const));
      const existingCostIds = new Set((existingCostsResp as any).data?.map((c: any) => c.id) || []);

      // Filtrar piezas directas que refieren a movimientos/costos eliminados
      const directParts = (directPartsRaw || []).filter(part => {
        if (part.inventory_movement_id && !activeMovementIds.has(part.inventory_movement_id)) {
          return false;
        }
        if (part.cost_id && !existingCostIds.has(part.cost_id)) {
          return false;
        }
        return true;
      });

      const normalizeDirect = (part: CranePart): CranePart => {
        if (!part.inventory_movement_id) return part;
        const movement = movementById.get(part.inventory_movement_id);
        if (!movement) return part;
        if (movement.movement_type !== 'exit') return part;

        const qty = typeof movement.quantity === 'number' ? Math.abs(movement.quantity) : Math.abs(part.quantity || 0);
        const unit = typeof movement.unit_cost === 'number' ? movement.unit_cost : part.unit_price;
        const total =
          typeof movement.total_cost === 'number'
            ? movement.total_cost
            : typeof unit === 'number' && typeof qty === 'number'
            ? unit * qty
            : part.total_value;

        return {
          ...part,
          quantity: qty,
          unit_price: unit,
          total_value: total,
        };
      };

      // Si solo queremos fuente directa, devolvemos aquí
      if (sourceMode === 'direct') {
        const byKey = new Map<string, CranePart>();
        (directParts || []).map(normalizeDirect).forEach(part => {
          const key =
            part.inventory_movement_id
              ? `m:${part.inventory_movement_id}`
              : part.cost_id
              ? `c:${part.cost_id}`
              : `d:${part.crane_id}|${(part.part_name || '').trim().toLowerCase()}|${part.date}|${part.quantity}|${part.unit_price}|${part.total_value}`;
          const existing = byKey.get(key);
          if (!existing) {
            byKey.set(key, part);
          } else {
            const tNew = part.created_at ? new Date(part.created_at).getTime() : 0;
            const tOld = existing.created_at ? new Date(existing.created_at).getTime() : 0;
            if (tNew > tOld) byKey.set(key, part);
          }
        });
        const deduped = Array.from(byKey.values()).map(p => ({ ...p, origin: 'direct' as const }));
        deduped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return deduped as EnhancedCranePart[];
      }

      // Obtener IDs de costos que ya están vinculados en crane_parts
      const linkedCostIds = (directParts || [])
        .map(part => part.cost_id)
        .filter(id => id !== null);

      // Obtener piezas que vienen de costos de mantenimiento NO vinculados
      let costPartsQuery = supabase
        .from('costs')
        .select(COST_PARTS_SELECT)
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
        .select(INVENTORY_CONSUMPTION_SELECT)
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
        supplier_id: null,
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
        supplier_id: null,
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
      const enhancedDirectParts: EnhancedCranePart[] = (directParts || []).map(normalizeDirect).map(part => ({
        ...part,
        origin: 'direct' as const,
      }));

      // Combinar todas las listas y ordenar por fecha
      const combinedParts = [...enhancedDirectParts, ...costBasedParts, ...consumptionBasedParts];

      const originPriority = (p: EnhancedCranePart) => (p.origin === 'direct' ? 3 : p.origin === 'cost' ? 2 : 1);
      const partKey = (p: EnhancedCranePart) => {
        if (p.inventory_movement_id) return `m:${p.inventory_movement_id}`;
        if (p.cost_id) return `c:${p.cost_id}`;
        const supplierPart = (p.supplier || '').trim().toLowerCase();
        const namePart = (p.part_name || '').trim().toLowerCase();
        return `d:${p.crane_id}|${namePart}|${supplierPart}|${p.date}|${p.quantity}|${p.unit_price}|${p.total_value}`;
      };

      const dedup = new Map<string, EnhancedCranePart>();
      for (const p of combinedParts) {
        const key = partKey(p);
        const existing = dedup.get(key);
        if (!existing) {
          dedup.set(key, p);
          continue;
        }
        const pPri = originPriority(p);
        const ePri = originPriority(existing);
        if (pPri > ePri) {
          dedup.set(key, p);
          continue;
        }
        if (pPri < ePri) continue;

        const pTime = p.created_at ? new Date(p.created_at).getTime() : 0;
        const eTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
        if (pTime > eTime) dedup.set(key, p);
      }

      const allParts = Array.from(dedup.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
        .select(CRANE_PARTS_SELECT)
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
        .select(CRANE_PARTS_SELECT)
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
        .select('id, supplier, total_value, date')
        .eq('crane_id', craneId);

      if (directPartsError) throw directPartsError;

      // Get parts from costs (maintenance category with subcategory "Piezas y Repuestos")
      const { data: costParts, error: costPartsError } = await supabase
        .from('costs')
        .select('id, amount, date, description')
        .eq('crane_id', craneId)
        .eq('subcategory', 'Piezas y Repuestos');

      if (costPartsError) throw costPartsError;

      // Get inventory consumptions
      const { data: consumptions, error: consumptionsError } = await supabase
        .from('inventory_movements')
        .select('id, movement_date, total_cost')
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
