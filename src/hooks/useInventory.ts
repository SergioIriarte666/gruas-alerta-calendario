import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createInventoryCost } from '@/utils/inventoryCostHelper';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useUniversalSync } from './useUniversalSync';  // FASE 5

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  unit_of_measure: string;
  minimum_stock: number;
  maximum_stock: number;
  safety_stock: number;
  unit_cost: number;
  is_active: boolean;
  is_critical: boolean;
  has_expiration: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  category?: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface InventoryStock {
  id: string;
  item_id: string;
  location_id: string;
  current_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_movement_date?: string;
  item?: InventoryItem;
  location?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  location_id: string;
  movement_type: 'entry' | 'exit' | 'transfer' | 'adjustment';
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_document?: string;
  batch_number?: string;
  expiration_date?: string;
  supplier_id?: string;
  supplier_name?: string;
  crane_id?: string;
  operator_id?: string;
  maintenance_id?: string;
  reason?: string;
  observations?: string;
  status: 'active' | 'cancelled';
  movement_date: string;
  created_at: string;
  created_by?: string;
  cost_id?: string;
  item?: InventoryItem;
  location?: {
    id: string;
    name: string;
    code: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
  crane?: {
    id: string;
    license_plate: string;
  };
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  code: string;
  description?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface InventorySupplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  rut?: string;
  payment_terms?: string;
  delivery_time_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Hooks for inventory items
export const useInventoryItems = () => {
  return useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          category:inventory_categories(id, name, code)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as InventoryItem[];
    },
  });
};

export const usePagedInventoryItems = (page: number, pageSize: number) => {
  return useQuery({
    queryKey: ['inventory-items', 'paged', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('inventory_items')
        .select(
          `
          *,
          category:inventory_categories(id, name, code)
        `,
          { count: 'exact' }
        )
        .eq('is_active', true)
        .order('name')
        .range(from, to);

      if (error) throw error;

      const items = (data || []) as InventoryItem[];

      return {
        items,
        total: typeof count === 'number' ? count : items.length,
      };
    },
    enabled: page > 0 && pageSize > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

// Hooks for inventory stock
export const useInventoryStock = () => {
  return useQuery({
    queryKey: ['inventory-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          *,
          item:inventory_items(*),
          location:inventory_locations(id, name, code)
        `)
        .order('current_quantity', { ascending: true });

      if (error) throw error;
      return data as InventoryStock[];
    },
  });
};

// Hooks for low stock items
export const useLowStockItems = () => {
  return useQuery({
    queryKey: ['low-stock-items'],
    queryFn: async () => {
      // Get all stock data with item info
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          *,
          item:inventory_items(*),
          location:inventory_locations(id, name, code)
        `)
        .order('current_quantity', { ascending: true });

      if (error) throw error;
      
      // Filter low stock items in JavaScript since Supabase doesn't support cross-table filters easily
      const lowStockItems = (data || []).filter(stock => 
        stock.item && stock.current_quantity <= (stock.item.minimum_stock || 0)
      );
      
      return lowStockItems as InventoryStock[];
    },
  });
};

// Hooks for inventory movements
export const useInventoryMovements = (limit = 50) => {
  return useQuery({
    queryKey: ['inventory-movements', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          item:inventory_items(id, name),
          location:inventory_locations(id, name, code),
          supplier:suppliers(id, name),
          crane:cranes(id, license_plate)
        `)
        .eq('status', 'active')
        .order('movement_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as InventoryMovement[];
    },
  });
};

export const useInventoryMovementsByReference = (reference: string | null) => {
  return useQuery({
    queryKey: ['inventory-movements', 'reference', reference],
    queryFn: async () => {
      if (!reference) return [];
      
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          item:inventory_items(id, name, sku, code),
          location:inventory_locations(id, name, code)
        `)
        .eq('reference_document', reference)
        .eq('movement_type', 'entry')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as InventoryMovement[];
    },
    enabled: !!reference,
  });
};

export const usePagedInventoryMovements = (page: number, pageSize: number) => {
  return useQuery({
    queryKey: ['inventory-movements', 'paged', page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('inventory_movements')
        .select(
          `
          *,
          item:inventory_items(id, name),
          location:inventory_locations(id, name, code),
          supplier:suppliers(id, name),
          crane:cranes(id, license_plate)
        `,
          { count: 'exact' }
        )
        .eq('status', 'active')
        .order('movement_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const movements = (data || []) as InventoryMovement[];

      return {
        movements,
        total: typeof count === 'number' ? count : movements.length,
      };
    },
    enabled: page > 0 && pageSize > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

// Hooks for categories
export const useInventoryCategories = () => {
  return useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as InventoryCategory[];
    },
  });
};

// Hooks for locations
export const useInventoryLocations = () => {
  return useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as InventoryLocation[];
    },
  });
};

// Hooks for suppliers
export const useInventorySuppliers = () => {
  return useQuery({
    queryKey: ['inventory-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as InventorySupplier[];
    },
  });
};

// Hook for inventory statistics
export const useInventoryStats = () => {
  return useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      // Get total items count
      const { count: totalItems } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get low stock count (need to implement this with a better query)
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select(`
          current_quantity,
          item:inventory_items(minimum_stock)
        `);

      const lowStockCount = stockData?.filter(
        stock => stock.current_quantity <= (stock.item?.minimum_stock || 0)
      ).length || 0;

      const outOfStockCount = stockData?.filter(
        stock => stock.current_quantity === 0
      ).length || 0;

      // Calculate total inventory value
      const { data: valueData } = await supabase
        .from('inventory_stock')
        .select(`
          current_quantity,
          item:inventory_items(unit_cost)
        `);

      const totalValue = valueData?.reduce((sum, stock) => {
        return sum + (stock.current_quantity * (stock.item?.unit_cost || 0));
      }, 0) || 0;

      return {
        totalItems: totalItems || 0,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalValue
      };
    },
  });
};

// Mutation for creating inventory movements
export const useCreateInventoryMovement = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();  // FASE 5: Sincronización universal

  return useMutation({
    mutationFn: async (movement: Omit<InventoryMovement, 'id' | 'created_at' | 'status'> & { generateCost?: boolean }) => {
      // Validate movement data before inserting
      if (!movement.item_id || !movement.location_id || !movement.movement_type || movement.quantity <= 0) {
        throw new Error('Datos del movimiento incompletos o inválidos');
      }

      // Check for exit movements that would result in negative stock
      if (movement.movement_type === 'exit') {
        const { data: stockData } = await supabase
          .from('inventory_stock')
          .select('current_quantity')
          .eq('item_id', movement.item_id)
          .eq('location_id', movement.location_id)
          .single();

        if (stockData && stockData.current_quantity < movement.quantity) {
          throw new Error(`Stock insuficiente. Disponible: ${stockData.current_quantity}, Solicitado: ${movement.quantity}`);
        }
      }

      let costId: string | undefined;

      // Create cost entry if it's an entry movement with cost and generateCost is true
      if (movement.movement_type === 'entry' && movement.generateCost && movement.unit_cost && movement.unit_cost > 0) {
        // Get item name for cost description
        const { data: itemData } = await supabase
          .from('inventory_items')
          .select('name')
          .eq('id', movement.item_id)
          .single();

        if (itemData) {
          const totalCost = movement.unit_cost * movement.quantity;
          const cost = await createInventoryCost({
            amount: totalCost,
            description: `Compra de inventario: ${itemData.name}`,
            date: movement.movement_date.split('T')[0],
            item_name: itemData.name,
            supplier_name: movement.supplier_name,
            quantity: movement.quantity,
            unit_cost: movement.unit_cost,
            inventory_item_id: movement.item_id
          });
          costId = cost.id;
        }
      }

      // Extract generateCost field before inserting to database
      const { generateCost, ...movementData } = movement;
      
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert([{
          ...movementData,
          cost_id: costId,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // FASE 5: Invalidar todas las queries relacionadas
      invalidateAll();
      toast.success('Movimiento de inventario registrado correctamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Registrar Movimiento',
      context: 'useInventory - createMovement'
    }),
  });
};

// Mutation for creating inventory items
export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert([item])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success('Producto agregado al inventario correctamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Agregar Producto',
      context: 'useInventory - createItem'
    }),
  });
};

// Mutation for updating inventory items
export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success('Producto actualizado correctamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Producto',
      context: 'useInventory - updateItem'
    }),
  });
};

// Mutation for updating inventory movements
export const useUpdateInventoryMovement = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InventoryMovement> }) => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      toast.success('Movimiento actualizado correctamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Movimiento',
      context: 'useInventory - updateMovement'
    }),
  });
};

// Mutation for cancelling inventory movements
export const useCancelInventoryMovement = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_movements')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      toast.success('Movimiento anulado correctamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Anular Movimiento',
      context: 'useInventory - cancelMovement'
    }),
  });
};

// Mutation for deleting inventory items
export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success('Producto desactivado correctamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Desactivar Producto',
      context: 'useInventory - deleteItem'
    }),
  });
};
