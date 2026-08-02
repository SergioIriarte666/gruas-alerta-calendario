import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createInventoryCost } from '@/utils/inventoryCostHelper';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useUniversalSync } from './useUniversalSync';  // FASE 5
import { businessClock } from '@/utils/businessClock';
import { getBusinessTimestampBounds } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";
import type { EntityKey } from '@/lib/entities';
import type { InventoryEntityFilter } from '@/utils/inventoryEntity';
import {
  selectLowStock,
  selectOutOfStockWithoutMinimum,
  summarizeStockByProduct,
  type ProductStockSummary,
  type StockRowInput,
} from '@/utils/lowStock';

const logger = createLogger("useInventory");

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
  sale_markup_percent?: number | null;
  sale_price_fixed?: number | null;
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
    entity: EntityKey;
  };
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  location_id: string;
  destination_location_id?: string | null;
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
  supplier_invoice_id?: string | null;
  supplier_invoice_item_id?: string | null;
  item?: Pick<InventoryItem, 'id' | 'name'> & Partial<InventoryItem>;
  location?: {
    id: string;
    name: string;
    code: string;
    entity: EntityKey;
  };
  destination_location?: {
    id: string;
    name: string;
    code: string;
    entity: EntityKey;
  } | null;
  supplier?: {
    id: string;
    name: string;
  };
  crane?: {
    id: string;
    license_plate: string;
  };
}

export interface MergeInventoryItemsResult {
  success: boolean;
  master_item_id: string;
  duplicate_items_merged: number;
  movements_reassigned: number;
  alerts_reassigned: number;
  cost_links_reassigned: number;
  supplier_invoice_links_reassigned: number;
  stock_rows_rebuilt: number;
  master_name: string;
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
  entity: EntityKey;
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

const INVENTORY_ITEM_SELECT = `
  id,
  name,
  description,
  sku,
  barcode,
  category_id,
  unit_of_measure,
  minimum_stock,
  maximum_stock,
  safety_stock,
  unit_cost,
  sale_markup_percent,
  sale_price_fixed,
  is_active,
  is_critical,
  has_expiration,
  created_at,
  updated_at,
  created_by,
  category:inventory_categories(id, name, code)
`;

const INVENTORY_ITEM_EMBED_SELECT = `
  id,
  name,
  description,
  sku,
  barcode,
  category_id,
  unit_of_measure,
  minimum_stock,
  maximum_stock,
  safety_stock,
  unit_cost,
  sale_markup_percent,
  sale_price_fixed,
  is_active,
  is_critical,
  has_expiration,
  created_at,
  updated_at,
  created_by
`;

const INVENTORY_STOCK_SELECT = `
  id,
  item_id,
  location_id,
  current_quantity,
  reserved_quantity,
  available_quantity,
  last_movement_date,
  item:inventory_items(${INVENTORY_ITEM_EMBED_SELECT}),
  location:inventory_locations(id, name, code, entity)
`;

const INVENTORY_MOVEMENT_SELECT = `
  id,
  item_id,
  location_id,
  destination_location_id,
  movement_type,
  quantity,
  unit_cost,
  total_cost,
  reference_document,
  batch_number,
  expiration_date,
  supplier_id,
  supplier_name,
  crane_id,
  operator_id,
  maintenance_id,
  reason,
  observations,
  status,
  movement_date,
  created_at,
  created_by,
  cost_id,
  supplier_invoice_id,
  supplier_invoice_item_id,
  item:inventory_items(id, name),
  location:inventory_locations!inventory_movements_location_id_fkey(id, name, code, entity),
  destination_location:inventory_locations!inventory_movements_destination_location_id_fkey(id, name, code, entity),
  supplier:inventory_suppliers(id, name),
  crane:cranes(id, license_plate)
`;

const INVENTORY_MOVEMENT_REFERENCE_SELECT = `
  id,
  item_id,
  location_id,
  destination_location_id,
  movement_type,
  quantity,
  unit_cost,
  total_cost,
  reference_document,
  batch_number,
  expiration_date,
  supplier_id,
  supplier_name,
  crane_id,
  operator_id,
  maintenance_id,
  reason,
  observations,
  status,
  movement_date,
  created_at,
  created_by,
  cost_id,
  supplier_invoice_id,
  supplier_invoice_item_id,
  item:inventory_items(id, name, sku, code),
  location:inventory_locations!inventory_movements_location_id_fkey(id, name, code, entity),
  destination_location:inventory_locations!inventory_movements_destination_location_id_fkey(id, name, code, entity)
`;

const INVENTORY_SUPPLIER_SELECT = `
  id,
  name,
  contact_person,
  email,
  phone,
  address,
  rut,
  payment_terms,
  delivery_time_days,
  is_active,
  created_at,
  updated_at,
  created_by
`;

// Hooks for inventory items
export const useInventoryItems = () => {
  return useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(INVENTORY_ITEM_SELECT)
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
          INVENTORY_ITEM_SELECT,
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

const getInventoryLocationIdsForEntity = async (entityFilter: InventoryEntityFilter): Promise<string[] | null> => {
  if (entityFilter === 'all') return null;

  const { data, error } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('is_active', true)
    .eq('entity', entityFilter);

  if (error) throw error;
  return (data || []).map((location) => location.id);
};

const applyMovementLocationFilter = <T extends { or: (filters: string) => T }>(
  query: T,
  locationIds: string[] | null,
) => {
  if (!locationIds) return query;
  const ids = locationIds.join(',');
  return query.or(`location_id.in.(${ids}),destination_location_id.in.(${ids})`);
};

const applyStockLocationFilter = <T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  locationIds: string[] | null,
) => {
  if (!locationIds) return query;
  return query.in('location_id', locationIds);
};

// Hooks for inventory stock
export const useInventoryStock = (entityFilter: InventoryEntityFilter = 'all') => {
  return useQuery({
    queryKey: ['inventory-stock', entityFilter],
    queryFn: async () => {
      const locationIds = await getInventoryLocationIdsForEntity(entityFilter);
      if (locationIds && locationIds.length === 0) return [];

      let query = supabase
        .from('inventory_stock')
        .select(INVENTORY_STOCK_SELECT)
        .order('current_quantity', { ascending: true });

      query = applyStockLocationFilter(query, locationIds);

      const { data, error } = await query;

      if (error) throw error;
      return data as InventoryStock[];
    },
  });
};

/**
 * Filas de existencia normalizadas para el cálculo de stock bajo.
 * La definición vive en `@/utils/lowStock`, no acá: la comparten la tarjeta KPI,
 * el panel de Bodega, la tabla de stock y los reportes.
 */
const toStockRowInputs = (rows: InventoryStock[] | null): StockRowInput[] =>
  (rows || [])
    .filter((row) => !!row.item)
    .map((row) => ({
      itemId: row.item_id,
      itemName: row.item?.name || 'Producto sin nombre',
      sku: row.item?.sku ?? null,
      isActive: row.item?.is_active !== false,
      minimumStock: row.item?.minimum_stock,
      quantity: row.current_quantity,
      locationName: row.location?.name ?? null,
    }));

const fetchStockSummaries = async (
  entityFilter: InventoryEntityFilter,
): Promise<ProductStockSummary[]> => {
  const locationIds = await getInventoryLocationIdsForEntity(entityFilter);
  if (locationIds && locationIds.length === 0) return [];

  let query = supabase
    .from('inventory_stock')
    .select(INVENTORY_STOCK_SELECT)
    .order('current_quantity', { ascending: true });

  query = applyStockLocationFilter(query, locationIds);

  const { data, error } = await query;
  if (error) throw error;

  return summarizeStockByProduct(toStockRowInputs(data as InventoryStock[]));
};

// Hooks for low stock items
/**
 * Productos activos bajo su mínimo, agrupados por producto (no por ubicación) y
 * excluyendo los que no tienen mínimo definido. Ver `@/utils/lowStock`.
 */
export const useLowStockItems = (entityFilter: InventoryEntityFilter = 'all') => {
  return useQuery({
    queryKey: ['low-stock-items', entityFilter],
    queryFn: async (): Promise<ProductStockSummary[]> =>
      selectLowStock(await fetchStockSummaries(entityFilter)),
  });
};

/** Productos activos agotados que todavía no tienen mínimo cargado. */
export const useOutOfStockWithoutMinimum = (entityFilter: InventoryEntityFilter = 'all') => {
  return useQuery({
    queryKey: ['out-of-stock-no-minimum', entityFilter],
    queryFn: async (): Promise<ProductStockSummary[]> =>
      selectOutOfStockWithoutMinimum(await fetchStockSummaries(entityFilter)),
  });
};

// Hooks for inventory movements
export const useInventoryMovements = (limit = 50, entityFilter: InventoryEntityFilter = 'all') => {
  return useQuery({
    queryKey: ['inventory-movements', limit, entityFilter],
    queryFn: async () => {
      const locationIds = await getInventoryLocationIdsForEntity(entityFilter);
      if (locationIds && locationIds.length === 0) return [];

      let query = supabase
        .from('inventory_movements')
        .select(INVENTORY_MOVEMENT_SELECT)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      query = applyMovementLocationFilter(query, locationIds);

      const { data, error } = await query;

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
        .select(INVENTORY_MOVEMENT_REFERENCE_SELECT)
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

// Filtros server-side para el historial de movimientos. Todo se resuelve en la BD
// (no client-side sobre una página) para que el conteo y la paginación reflejen
// el universo real de movimientos activos.
export interface InventoryMovementQueryFilters {
  entityFilter?: InventoryEntityFilter;
  movementType?: string; // 'all' | 'entry' | 'exit' | 'transfer' | 'adjustment'
  locationId?: string;   // 'all' | <uuid>
  search?: string;       // texto libre
  dateFrom?: string;     // YYYY-MM-DD (día comercial)
  dateTo?: string;       // YYYY-MM-DD (día comercial)
  sortDir?: 'asc' | 'desc'; // dirección por movement_date (default 'desc')
}

// Sanea texto para incrustarlo en el DSL de PostgREST (.or()), que trata comas y
// paréntesis como separadores. Los quitamos para no romper el filtro.
const sanitizeOrToken = (value: string): string => value.replace(/[(),]/g, ' ').trim();

// Resuelve los item_id cuyo nombre coincide con la búsqueda, para poder buscar
// también por producto (columna en tabla embebida) de forma server-side.
const resolveSearchItemIds = async (search: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id')
    .ilike('name', `%${search}%`)
    .limit(1000);
  if (error) {
    logger.warn('No se pudieron resolver items para la búsqueda de movimientos', error);
    return [];
  }
  return (data || []).map((row) => row.id);
};

// Aplica los filtros comunes (entidad, tipo, ubicación, rango de fechas y
// búsqueda) a una query de inventory_movements ya con .select() aplicado.
// Devuelve null cuando el filtro de entidad no tiene ubicaciones (resultado vacío).
const applyInventoryMovementFilters = async <
  T extends {
    eq: (column: string, value: unknown) => T;
    gte: (column: string, value: unknown) => T;
    lte: (column: string, value: unknown) => T;
    or: (filters: string) => T;
  },
>(
  query: T,
  filters: InventoryMovementQueryFilters,
): Promise<{ query: T } | null> => {
  const entityFilter = filters.entityFilter ?? 'all';
  const locationIds = await getInventoryLocationIdsForEntity(entityFilter);
  if (locationIds && locationIds.length === 0) return null;

  let q = applyMovementLocationFilter(query, locationIds);

  if (filters.movementType && filters.movementType !== 'all') {
    q = q.eq('movement_type', filters.movementType);
  }

  if (filters.locationId && filters.locationId !== 'all') {
    q = q.eq('location_id', filters.locationId);
  }

  const { gte, lte } = getBusinessTimestampBounds(filters.dateFrom, filters.dateTo);
  if (gte) q = q.gte('movement_date', gte);
  if (lte) q = q.lte('movement_date', lte);

  const search = filters.search?.trim();
  if (search) {
    const token = sanitizeOrToken(search);
    if (token) {
      const orParts = [
        `reference_document.ilike.%${token}%`,
        `reason.ilike.%${token}%`,
        `batch_number.ilike.%${token}%`,
        `supplier_name.ilike.%${token}%`,
      ];
      const itemIds = await resolveSearchItemIds(token);
      if (itemIds.length > 0) {
        orParts.push(`item_id.in.(${itemIds.join(',')})`);
      }
      q = q.or(orParts.join(','));
    }
  }

  // Los builders de Supabase son thenables. Si se retornan directamente desde
  // una función async, JavaScript los ejecuta y resuelve al response antes de
  // que el consumidor pueda encadenar order/range. La envoltura evita esa
  // asimilación automática y conserva el builder sin ejecutar.
  return { query: q };
};

// Orden estable del historial. Se utiliza created_at porque es la columna que
// comparten todos los movimientos históricos y coincide con la consulta del
// resumen de Bodega. Algunos registros importados tienen movement_date legado
// y PostgREST puede rechazar/romper el orden paginado sobre esa columna.
const getMovementOrdering = (sortDir: 'asc' | 'desc' = 'desc') => [
  { column: 'created_at', ascending: sortDir === 'asc' },
];

export const usePagedInventoryMovements = (
  page: number,
  pageSize: number,
  filters: InventoryMovementQueryFilters = {},
) => {
  return useQuery({
    queryKey: ['inventory-movements', 'paged', page, pageSize, filters],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const base = supabase
        .from('inventory_movements')
        .select(INVENTORY_MOVEMENT_SELECT, { count: 'exact' })
        .eq('status', 'active');

      const filtered = await applyInventoryMovementFilters(base, filters);
      if (!filtered) return { movements: [], total: 0 };

      let query = filtered.query;
      for (const { column, ascending } of getMovementOrdering(filters.sortDir)) {
        query = query.order(column, { ascending });
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      const movements = (data || []) as InventoryMovement[];

      return {
        movements,
        total: typeof count === 'number' ? count : movements.length,
      };
    },
    enabled: page > 0 && pageSize > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Trae TODOS los movimientos que coinciden con los filtros (sin paginar), para
// exportación. Ordenado igual que el listado.
export const fetchInventoryMovementsForExport = async (
  filters: InventoryMovementQueryFilters = {},
): Promise<InventoryMovement[]> => {
  const base = supabase
    .from('inventory_movements')
    .select(INVENTORY_MOVEMENT_SELECT)
    .eq('status', 'active');

  const filtered = await applyInventoryMovementFilters(base, filters);
  if (!filtered) return [];

  let query = filtered.query;
  for (const { column, ascending } of getMovementOrdering(filters.sortDir)) {
    query = query.order(column, { ascending });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as InventoryMovement[];
};

// Hooks for categories
export const useInventoryCategories = () => {
  return useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('id, name, description, code, is_active, created_at, updated_at, created_by')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as InventoryCategory[];
    },
  });
};

// Hooks for locations
export const useInventoryLocations = (entityFilter: InventoryEntityFilter = 'all') => {
  return useQuery({
    queryKey: ['inventory-locations', entityFilter],
    queryFn: async () => {
      let query = supabase
        .from('inventory_locations')
        .select('id, name, code, description, address, entity, is_active, created_at, updated_at, created_by')
        .eq('is_active', true)
        .order('name');

      if (entityFilter !== 'all') query = query.eq('entity', entityFilter);

      const { data, error } = await query;

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
        .select(INVENTORY_SUPPLIER_SELECT)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as InventorySupplier[];
    },
  });
};

// Hook for inventory statistics
export const useInventoryStats = (entityFilter: InventoryEntityFilter = 'all') => {
  return useQuery({
    queryKey: ['inventory-stats', entityFilter],
    queryFn: async () => {
      // Get total items count
      let totalItems = 0;
      if (entityFilter === 'all') {
        const { count } = await supabase
          .from('inventory_items')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);
        totalItems = count || 0;
      }

      const locationIds = await getInventoryLocationIdsForEntity(entityFilter);
      if (locationIds && locationIds.length === 0) {
        return {
          totalItems: 0,
          lowStock: 0,
          outOfStock: 0,
          totalValue: 0
        };
      }

      // Stock bajo y agotados: se agrupa por producto ANTES de comparar, porque
      // inventory_stock tiene una fila por producto+ubicación y el mínimo es del
      // producto. La definición vive en @/utils/lowStock.
      let stockQuery = supabase
        .from('inventory_stock')
        .select(`
          item_id,
          current_quantity,
          item:inventory_items(name, is_active, minimum_stock)
        `);

      if (locationIds) stockQuery = stockQuery.in('location_id', locationIds);

      const { data: stockData } = await stockQuery;

      const summaries = summarizeStockByProduct(
        (stockData || [])
          .filter((stock) => !!stock.item)
          .map((stock) => ({
            itemId: stock.item_id,
            itemName: stock.item?.name || 'Producto sin nombre',
            isActive: stock.item?.is_active !== false,
            minimumStock: stock.item?.minimum_stock,
            quantity: stock.current_quantity,
          })),
      );

      if (entityFilter !== 'all') {
        totalItems = summaries.length;
      }

      const lowStockCount = selectLowStock(summaries).length;
      const outOfStockCount = selectOutOfStockWithoutMinimum(summaries).length;

      // Calculate total inventory value
      let valueQuery = supabase
        .from('inventory_stock')
        .select(`
          current_quantity,
          item:inventory_items(unit_cost)
        `);

      if (locationIds) valueQuery = valueQuery.in('location_id', locationIds);

      const { data: valueData } = await valueQuery;

      const totalValue = valueData?.reduce((sum, stock) => {
        return sum + (stock.current_quantity * (stock.item?.unit_cost || 0));
      }, 0) || 0;

      return {
        totalItems,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalValue
      };
    },
  });
};

// Mutation for creating inventory movements
export const useCreateInventoryMovement = () => {
  const _queryClient = useQueryClient();
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
          logger.error('[useInventory] Stock insuficiente para movimiento de salida:', { available: stockData.current_quantity, requested: movement.quantity });
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
            date: businessClock.format(movement.movement_date, 'yyyy-MM-dd'),
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
      const { generateCost: _generateCost, ...movementData } = movement;
      
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert([{
          ...movementData,
          cost_id: costId,
          status: 'active'
        }])
        .select()
        .single();

      if (error) {
        const supabaseError = error as any;
        if (
          supabaseError?.code === '23505' &&
          typeof supabaseError?.message === 'string' &&
          supabaseError.message.includes('uniq_inventory_entry_active_per_cost') &&
          costId
        ) {
          const { data: existingEntry, error: existingEntryError } = await supabase
            .from('inventory_movements')
            .select('*')
            .eq('cost_id', costId)
            .eq('movement_type', 'entry')
            .eq('status', 'active')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (existingEntryError || !existingEntry) {
          logger.error('[useInventory] Error creando movimiento de inventario (23505 sin entrada existente):', error);
          throw error;
        }

          const updates: Partial<InventoryMovement> = {};
          if (!existingEntry.supplier_id && (movementData as any).supplier_id) updates.supplier_id = (movementData as any).supplier_id;
          if (!existingEntry.supplier_name && (movementData as any).supplier_name) updates.supplier_name = (movementData as any).supplier_name;
          if (!existingEntry.batch_number && (movementData as any).batch_number) updates.batch_number = (movementData as any).batch_number;
          if (!existingEntry.expiration_date && (movementData as any).expiration_date) updates.expiration_date = (movementData as any).expiration_date;
          if (!existingEntry.reference_document && (movementData as any).reference_document) updates.reference_document = (movementData as any).reference_document;
          if ((!existingEntry.observations || existingEntry.observations.trim() === '') && (movementData as any).observations) updates.observations = (movementData as any).observations;

          if (Object.keys(updates).length === 0) return existingEntry as any;

          const { data: updatedEntry, error: updateError } = await supabase
            .from('inventory_movements')
            .update(updates)
            .eq('id', existingEntry.id)
            .select()
            .single();

          if (updateError || !updatedEntry) return existingEntry as any;
          return updatedEntry as any;
        }

        logger.error('[useInventory] Error creando movimiento de inventario:', error);
        throw error;
      }
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

      if (error) {
        logger.error('[useInventory] Error creando ítem de inventario:', error);
        throw error;
      }
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

      if (error) {
        logger.error('[useInventory] Error actualizando ítem de inventario:', error);
        throw error;
      }
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

export const useMergeInventoryItems = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  return useMutation({
    mutationFn: async ({
      masterItemId,
      duplicateItemIds,
      masterName,
    }: {
      masterItemId: string;
      duplicateItemIds: string[];
      masterName?: string;
    }) => {
      const { data, error } = await supabase.rpc('merge_inventory_items', {
        p_master_item_id: masterItemId,
        p_duplicate_item_ids: duplicateItemIds,
        p_master_name: masterName || null,
      });

      if (error) {
        logger.error('[useInventory] Error fusionando ítems de inventario:', error);
        throw error;
      }
      return data as unknown as MergeInventoryItemsResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      toast.success('Productos fusionados correctamente', {
        description: `${result.duplicate_items_merged} duplicado(s) consolidados en "${result.master_name}"`,
      });
    },
    onError: createMutationErrorHandler({
      title: 'Error al Fusionar Productos',
      context: 'useInventory - mergeItems',
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

      if (error) {
        logger.error('[useInventory] Error actualizando movimiento de inventario:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail-inventory'] });
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

      if (error) {
        logger.error('[useInventory] Error anulando movimiento de inventario:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail-inventory'] });
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

      if (error) {
        logger.error('[useInventory] Error desactivando ítem de inventario:', error);
        throw error;
      }
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
