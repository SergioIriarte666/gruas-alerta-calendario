import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PartsTraceability {
  part_id: string;
  part_name: string;
  supplier: string;
  purchase_date: string;
  purchase_cost: number;
  inventory_item_id?: string;
  inventory_item_name?: string;
  current_stock: number;
  total_purchased: number;
  total_consumed: number;
  crane_license_plate: string;
}

export interface UnifiedPartPurchase {
  crane_id: string;
  part_name: string;
  supplier: string;
  phone?: string;
  quantity: number;
  unit_price: number;
  date: string;
  notes?: string;
  kilometraje?: number;
  // Inventory integration fields
  create_inventory_entry?: boolean;
  location_id?: string;
  minimum_stock?: number;
}

export interface InventoryConsumption {
  inventory_item_id: string;
  quantity: number;
  crane_id: string;
  operator_id?: string;
  reference_document?: string;
  observations?: string;
}

// Hook para obtener trazabilidad completa de piezas
export const usePartsTraceability = (craneId?: string) => {
  return useQuery({
    queryKey: ['parts-traceability', craneId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_parts_traceability', {
        p_crane_id: craneId && craneId !== 'all' ? craneId : null
      });

      if (error) throw error;
      return data as PartsTraceability[];
    },
  });
};

// Hook para compra unificada de piezas (crea entrada en inventario automáticamente)
export const useUnifiedPartsPurchase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseData: UnifiedPartPurchase) => {
      // Validación de datos de entrada
      if (!purchaseData.quantity || purchaseData.quantity <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
      }
      if (!purchaseData.unit_price || purchaseData.unit_price <= 0) {
        throw new Error('El precio unitario debe ser mayor a 0');
      }
      if (!purchaseData.part_name || purchaseData.part_name.trim() === '') {
        throw new Error('El nombre de la pieza es requerido');
      }
      if (!purchaseData.supplier || purchaseData.supplier.trim() === '') {
        throw new Error('El proveedor es requerido');
      }

      // Calcular total_value explícitamente
      const total_value = purchaseData.quantity * purchaseData.unit_price;

      console.log('🔧 Datos de compra validados:', {
        ...purchaseData,
        total_value,
        calculated_from: `${purchaseData.quantity} × ${purchaseData.unit_price}`
      });

      // El trigger se encargará de crear el costo y sincronizar inventario
      const { data, error } = await supabase
        .from('crane_parts')
        .insert([{
          crane_id: purchaseData.crane_id,
          part_name: purchaseData.part_name.trim(),
          supplier: purchaseData.supplier.trim(),
          quantity: purchaseData.quantity,
          unit_price: purchaseData.unit_price,
          total_value, // Valor calculado explícitamente
          date: purchaseData.date,
          notes: purchaseData.notes?.trim() || null,
          phone: purchaseData.phone?.trim() || null,
          kilometraje: purchaseData.kilometraje || null,
          // created_by será asignado por el trigger usando auth.uid()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al insertar pieza:', error);
        throw error;
      }

      console.log('✅ Pieza creada exitosamente:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      toast.success('Pieza registrada exitosamente. Se creó automáticamente la entrada de inventario.');
    },
    onError: (error: any) => {
      console.error('Error in unified parts purchase:', error);
      toast.error(error.message || 'Error al registrar la compra de pieza');
    },
  });
};

// Hook para consumo de inventario en grúas
export const useInventoryConsumption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (consumptionData: InventoryConsumption) => {
      const { data, error } = await supabase.rpc('create_inventory_consumption_movement', {
        p_inventory_item_id: consumptionData.inventory_item_id,
        p_quantity: consumptionData.quantity,
        p_crane_id: consumptionData.crane_id,
        p_operator_id: consumptionData.operator_id,
        p_reference_document: consumptionData.reference_document,
        p_observations: consumptionData.observations,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
      toast.success('Consumo de inventario registrado exitosamente');
    },
    onError: (error: any) => {
      console.error('Error in inventory consumption:', error);
      toast.error(error.message || 'Error al registrar el consumo de inventario');
    },
  });
};

// Hook para verificar si una pieza ya existe en inventario
export const useCheckInventoryItem = (partName: string) => {
  return useQuery({
    queryKey: ['check-inventory-item', partName],
    queryFn: async () => {
      if (!partName) return null;
      
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          unit_cost,
          inventory_stock(
            current_quantity,
            location:inventory_locations(name)
          )
        `)
        .ilike('name', partName)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!partName && partName.length > 2,
  });
};

// Hook para obtener estadísticas de sincronización
export const useInventorySyncStats = () => {
  return useQuery({
    queryKey: ['inventory-sync-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_inventory_sync_status' as any);
      
      if (error) throw error;
      
      return data as {
        total_parts: number;
        synced_parts: number;
        unsynced_parts: number;
        sync_percentage: number;
        total_inventory_items: number;
        auto_created_items: number;
        trigger_exists: boolean;
      };
    }
  });
};

// Hook para migrar piezas no sincronizadas
export const useMigrateUnsyncParts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('migrate_unsynced_crane_parts_to_inventory');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
      queryClient.invalidateQueries({ queryKey: ['bidirectional-sync-stats'] });
      
      const migrated = (data as any)?.migrated_count || 0;
      const errors = (data as any)?.error_count || 0;
      
      if (errors > 0) {
        toast.warning(`Migración completada con advertencias: ${migrated} piezas migradas, ${errors} errores`);
      } else {
        toast.success(`Migración exitosa: ${migrated} piezas sincronizadas al inventario`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error durante la migración de sincronización');
    },
  });
};

// Hook para migrar movimientos de consumo existentes
export const useMigrateConsumptionMovements = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('migrate_existing_consumption_movements');
      
      if (error) {
        console.error('Consumption migration error:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      const migrated = (data as any)?.migrated_count || 0;
      const errors = (data as any)?.error_count || 0;
      
      if (errors > 0) {
        toast.warning(`Migración de consumos completada con advertencias: ${migrated} movimientos migrados, ${errors} errores`);
      } else {
        toast.success(`Migración de consumos exitosa: ${migrated} movimientos sincronizados`);
      }
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['bidirectional-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
    },
    onError: (error: any) => {
      console.error('Consumption migration failed:', error);
      toast.error(`Error en migración de consumos: ${error.message}`);
    },
  });
};

// Check bidirectional sync status hook
export const useBidirectionalSyncStats = () => {
  return useQuery({
    queryKey: ['bidirectional-sync-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_bidirectional_sync_status');
      
      if (error) {
        console.error('Error fetching bidirectional sync stats:', error);
        throw error;
      }
      
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

// Hook para forzar re-sincronización de una pieza específica
export const useForceResyncPart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partId: string) => {
      const { data, error } = await supabase.rpc('force_resync_crane_part' as any, {
        part_id: partId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['parts-traceability'] });
      
      if (data.success) {
        toast.success(data.message || 'Re-sincronización completada');
      } else {
        toast.error(data.message || 'Error en la re-sincronización');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error durante la re-sincronización');
    },
  });
};