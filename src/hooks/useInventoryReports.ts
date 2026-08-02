import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import type { InventoryEntityFilter } from '@/utils/inventoryEntity';
import {
  selectLowStock,
  selectOutOfStockWithoutMinimum,
  summarizeStockByProduct,
} from '@/utils/lowStock';

const _logger = createLogger('useInventoryReports');

const STOCK_REPORT_SELECT = `
  item_id,
  current_quantity,
  inventory_items (
    name,
    is_active,
    unit_cost,
    minimum_stock,
    category_id,
    inventory_categories (name)
  ),
  inventory_locations (name)
`;

const MOVEMENT_REPORT_SELECT = `
  id,
  item_id,
  location_id,
  movement_type,
  movement_date,
  quantity,
  total_cost,
  supplier_name,
  inventory_items (
    name,
    unit_cost,
    category_id,
    inventory_categories (name)
  ),
  inventory_locations (name)
`;

const COST_ANALYSIS_SELECT = `
  movement_date,
  total_cost,
  supplier_name,
  inventory_items (
    name,
    unit_cost,
    category_id,
    inventory_categories (name)
  )
`;

const PREDICTIVE_MOVEMENTS_SELECT = `
  movement_date,
  quantity,
  inventory_items (
    name,
    category_id,
    inventory_categories (name)
  ),
  cranes (license_plate)
`;

const PREDICTIVE_STOCK_SELECT = `
  current_quantity,
  inventory_items (name)
`;

export interface InventoryReportFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  locationId?: string;
  itemId?: string;
  movementType?: string;
  craneId?: string;
  operatorId?: string;
  entityFilter?: InventoryEntityFilter;
}

const getReportLocationIdsForEntity = async (entityFilter?: InventoryEntityFilter): Promise<string[] | null> => {
  if (!entityFilter || entityFilter === 'all') return null;

  const { data, error } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('is_active', true)
    .eq('entity', entityFilter);

  if (error) throw error;
  return (data || []).map((location) => location.id);
};

const applyReportMovementLocationFilter = <T extends { or: (filters: string) => T }>(
  query: T,
  locationIds: string[] | null,
) => {
  if (!locationIds) return query;
  const ids = locationIds.join(',');
  return query.or(`location_id.in.(${ids}),destination_location_id.in.(${ids})`);
};

export interface StockReportData {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  itemsByCategory: Array<{
    category: string;
    quantity: number;
    value: number;
  }>;
  itemsByLocation: Array<{
    location: string;
    quantity: number;
    value: number;
  }>;
  lowStockAlert: Array<{
    item_name: string;
    current_quantity: number;
    minimum_stock: number;
    /** Unidades que faltan para llegar al mínimo. */
    missing: number;
    location_name: string;
    category_name: string;
  }>;
}

export interface MovementReportData {
  totalMovements: number;
  entriesCount: number;
  exitsCount: number;
  totalEntriesValue: number;
  totalExitsValue: number;
  movementsByType: Array<{
    movement_type: string;
    count: number;
    total_value: number;
  }>;
  movementsByDate: Array<{
    date: string;
    entries: number;
    exits: number;
    entries_value: number;
    exits_value: number;
  }>;
  topMovedItems: Array<{
    item_name: string;
    total_quantity: number;
    total_value: number;
    movement_count: number;
  }>;
}

export interface CostAnalysisData {
  totalInventoryValue: number;
  averageUnitCost: number;
  costByCategory: Array<{
    category: string;
    total_cost: number;
    avg_cost: number;
    item_count: number;
  }>;
  supplierAnalysis: Array<{
    supplier_name: string;
    total_spent: number;
    movement_count: number;
    avg_cost: number;
  }>;
  costTrends: Array<{
    month: string;
    total_cost: number;
    movement_count: number;
  }>;
}

export interface PredictiveAnalysisData {
  consumptionPatterns: Array<{
    item_name: string;
    avg_monthly_consumption: number;
    current_stock: number;
    days_until_stockout: number;
    recommended_reorder: number;
  }>;
  seasonalTrends: Array<{
    month: string;
    total_consumption: number;
    category_breakdown: Array<{
      category: string;
      consumption: number;
    }>;
  }>;
  craneConsumption: Array<{
    crane_license_plate: string;
    total_consumption: number;
    avg_monthly: number;
    top_items: Array<{
      item_name: string;
      quantity: number;
    }>;
  }>;
}

export const useStockReport = (filters?: InventoryReportFilters) => {
  return useQuery({
    queryKey: ['stock-report', filters],
    queryFn: async (): Promise<StockReportData> => {
      const entityLocationIds = await getReportLocationIdsForEntity(filters?.entityFilter);
      if (entityLocationIds && entityLocationIds.length === 0) {
        return {
          totalItems: 0,
          totalValue: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          itemsByCategory: [],
          itemsByLocation: [],
          lowStockAlert: [],
        };
      }

      // Get stock data with items and categories
      let query = supabase
        .from('inventory_stock')
        .select(STOCK_REPORT_SELECT);

      if (entityLocationIds) query = query.in('location_id', entityLocationIds);
      if (filters?.locationId) query = query.eq('location_id', filters.locationId);

      const { data: stockData, error: stockError } = await query;

      if (stockError) throw stockError;

      // Calculate totals
      const totalValue = stockData?.reduce((sum, item) =>
        sum + ((item.current_quantity || 0) * (item.inventory_items?.unit_cost || 0)), 0) || 0;
      
      // Stock bajo / agotados: agrupado por producto y sin los que no tienen mínimo
      // definido. Definición compartida en @/utils/lowStock.
      const stockSummaries = summarizeStockByProduct(
        (stockData || [])
          .filter((row) => !!row.inventory_items)
          .map((row) => ({
            itemId: row.item_id,
            itemName: row.inventory_items?.name || 'Producto sin nombre',
            isActive: row.inventory_items?.is_active !== false,
            minimumStock: row.inventory_items?.minimum_stock,
            quantity: row.current_quantity,
            locationName: row.inventory_locations?.name ?? null,
            categoryName: row.inventory_items?.inventory_categories?.name ?? null,
          })),
      );

      // Productos únicos activos, no filas de inventory_stock: un producto repartido
      // en dos ubicaciones es un solo producto.
      const totalItems = stockSummaries.length;
      const lowStock = selectLowStock(stockSummaries);
      const lowStockItems = lowStock.length;
      const outOfStockItems = selectOutOfStockWithoutMinimum(stockSummaries).length;

      // Group by category
      const categoryGroups = stockData?.reduce((acc, item) => {
        const categoryName = item.inventory_items?.inventory_categories?.name || 'Sin categoría';
        if (!acc[categoryName]) {
          acc[categoryName] = { quantity: 0, value: 0 };
        }
        acc[categoryName].quantity += item.current_quantity || 0;
        acc[categoryName].value += (item.current_quantity || 0) * (item.inventory_items?.unit_cost || 0);
        return acc;
      }, {} as Record<string, { quantity: number; value: number }>);

      const itemsByCategory = Object.entries(categoryGroups || {}).map(([category, data]) => ({
        category,
        ...data
      }));

      // Group by location
      const locationGroups = stockData?.reduce((acc, item) => {
        const locationName = item.inventory_locations?.name || 'Sin ubicación';
        if (!acc[locationName]) {
          acc[locationName] = { quantity: 0, value: 0 };
        }
        acc[locationName].quantity += item.current_quantity || 0;
        acc[locationName].value += (item.current_quantity || 0) * (item.inventory_items?.unit_cost || 0);
        return acc;
      }, {} as Record<string, { quantity: number; value: number }>);

      const itemsByLocation = Object.entries(locationGroups || {}).map(([location, data]) => ({
        location,
        ...data
      }));

      // Low stock alert
      const lowStockAlert = lowStock.map((summary) => ({
        item_name: summary.name,
        current_quantity: summary.quantity,
        minimum_stock: summary.minimumStock,
        missing: summary.missing,
        location_name: summary.locations.join(', '),
        category_name: summary.categoryName || '',
      }));

      return {
        totalItems,
        totalValue,
        lowStockItems,
        outOfStockItems,
        itemsByCategory,
        itemsByLocation,
        lowStockAlert
      };
    }
  });
};

export const useMovementReport = (filters?: InventoryReportFilters) => {
  return useQuery({
    queryKey: ['movement-report', filters],
    queryFn: async (): Promise<MovementReportData> => {
      let query = supabase
        .from('inventory_movements')
        .select(`
          ${MOVEMENT_REPORT_SELECT}
        `);
      const entityLocationIds = await getReportLocationIdsForEntity(filters?.entityFilter);
      if (entityLocationIds && entityLocationIds.length === 0) {
        return {
          totalMovements: 0,
          entriesCount: 0,
          exitsCount: 0,
          totalEntriesValue: 0,
          totalExitsValue: 0,
          movementsByType: [],
          movementsByDate: [],
          topMovedItems: [],
        };
      }

      // Apply filters
      if (filters?.dateFrom) {
        query = query.gte('movement_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('movement_date', filters.dateTo);
      }
      if (filters?.categoryId) {
        query = query.eq('inventory_items.category_id', filters.categoryId);
      }
      if (filters?.locationId) {
        query = query.or(`location_id.eq.${filters.locationId},destination_location_id.eq.${filters.locationId}`);
      } else if (entityLocationIds) {
        query = applyReportMovementLocationFilter(query, entityLocationIds);
      }
      if (filters?.movementType) {
        query = query.eq('movement_type', filters.movementType);
      }
      query = query.eq('status', 'active');

      const { data: movements, error } = await query;
      if (error) throw error;

      const totalMovements = movements?.length || 0;
      const entriesCount = movements?.filter(m => m.movement_type === 'entry').length || 0;
      const exitsCount = movements?.filter(m => m.movement_type === 'exit').length || 0;

      const totalEntriesValue = movements
        ?.filter(m => m.movement_type === 'entry')
        .reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

      const totalExitsValue = movements
        ?.filter(m => m.movement_type === 'exit')
        .reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

      // Group by movement type
      const typeGroups = movements?.reduce((acc, movement) => {
        const type = movement.movement_type || 'unknown';
        if (!acc[type]) {
          acc[type] = { count: 0, total_value: 0 };
        }
        acc[type].count++;
        acc[type].total_value += movement.total_cost || 0;
        return acc;
      }, {} as Record<string, { count: number; total_value: number }>);

      const movementsByType = Object.entries(typeGroups || {}).map(([movement_type, data]) => ({
        movement_type,
        ...data
      }));

      // Group by date (last 30 days)
      const dateGroups = movements?.reduce((acc, movement) => {
        const date = format(new Date(movement.movement_date), 'yyyy-MM-dd');
        if (!acc[date]) {
          acc[date] = { entries: 0, exits: 0, entries_value: 0, exits_value: 0 };
        }
        if (movement.movement_type === 'entry') {
          acc[date].entries++;
          acc[date].entries_value += movement.total_cost || 0;
        } else {
          acc[date].exits++;
          acc[date].exits_value += movement.total_cost || 0;
        }
        return acc;
      }, {} as Record<string, { entries: number; exits: number; entries_value: number; exits_value: number }>);

      const movementsByDate = Object.entries(dateGroups || {}).map(([date, data]) => ({
        date,
        ...data
      }));

      // Top moved items
      const itemGroups = movements?.reduce((acc, movement) => {
        const itemName = movement.inventory_items?.name || 'Unknown';
        if (!acc[itemName]) {
          acc[itemName] = { entries_quantity: 0, exits_quantity: 0, entries_value: 0, exits_value: 0, movement_count: 0 };
        }
        if (movement.movement_type === 'entry') {
          acc[itemName].entries_quantity += movement.quantity || 0;
          acc[itemName].entries_value += movement.total_cost || 0;
        } else {
          acc[itemName].exits_quantity += movement.quantity || 0;
          acc[itemName].exits_value += movement.total_cost || 0;
        }
        acc[itemName].movement_count++;
        return acc;
      }, {} as Record<string, { entries_quantity: number; exits_quantity: number; entries_value: number; exits_value: number; movement_count: number }>);

      const topMovedItems = Object.entries(itemGroups || {})
        .map(([item_name, data]) => ({
          item_name,
          total_quantity: data.entries_quantity,
          total_value: data.entries_value,
          net_quantity: data.entries_quantity - data.exits_quantity,
          exits_quantity: data.exits_quantity,
          exits_value: data.exits_value,
          movement_count: data.movement_count
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 10);

      return {
        totalMovements,
        entriesCount,
        exitsCount,
        totalEntriesValue,
        totalExitsValue,
        movementsByType,
        movementsByDate,
        topMovedItems
      };
    }
  });
};

export const useCostAnalysisReport = (filters?: InventoryReportFilters) => {
  return useQuery({
    queryKey: ['cost-analysis-report', filters],
    queryFn: async (): Promise<CostAnalysisData> => {
      // Get movements with cost data
      let query = supabase
        .from('inventory_movements')
        .select(COST_ANALYSIS_SELECT)
        .not('total_cost', 'is', null)
        .eq('status', 'active');
      const entityLocationIds = await getReportLocationIdsForEntity(filters?.entityFilter);
      if (entityLocationIds && entityLocationIds.length === 0) {
        return {
          totalInventoryValue: 0,
          averageUnitCost: 0,
          costByCategory: [],
          supplierAnalysis: [],
          costTrends: [],
        };
      }

      if (filters?.dateFrom) {
        query = query.gte('movement_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('movement_date', filters.dateTo);
      }
      if (filters?.locationId) {
        query = query.or(`location_id.eq.${filters.locationId},destination_location_id.eq.${filters.locationId}`);
      } else if (entityLocationIds) {
        query = applyReportMovementLocationFilter(query, entityLocationIds);
      }

      const { data: movements, error } = await query;
      if (error) throw error;

      const totalInventoryValue = movements?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;
      const averageUnitCost = movements?.length ? totalInventoryValue / movements.length : 0;

      // Cost by category
      const categoryGroups = movements?.reduce((acc, movement) => {
        const categoryName = movement.inventory_items?.inventory_categories?.name || 'Sin categoría';
        if (!acc[categoryName]) {
          acc[categoryName] = { total_cost: 0, item_count: 0, costs: [] };
        }
        acc[categoryName].total_cost += movement.total_cost || 0;
        acc[categoryName].item_count++;
        acc[categoryName].costs.push(movement.total_cost || 0);
        return acc;
      }, {} as Record<string, { total_cost: number; item_count: number; costs: number[] }>);

      const costByCategory = Object.entries(categoryGroups || {}).map(([category, data]) => ({
        category,
        total_cost: data.total_cost,
        avg_cost: data.total_cost / data.item_count,
        item_count: data.item_count
      }));

      // Supplier analysis
      const supplierGroups = movements?.reduce((acc, movement) => {
        const supplierName = movement.supplier_name || 'Sin proveedor';
        if (!acc[supplierName]) {
          acc[supplierName] = { total_spent: 0, movement_count: 0, costs: [] };
        }
        acc[supplierName].total_spent += movement.total_cost || 0;
        acc[supplierName].movement_count++;
        acc[supplierName].costs.push(movement.total_cost || 0);
        return acc;
      }, {} as Record<string, { total_spent: number; movement_count: number; costs: number[] }>);

      const supplierAnalysis = Object.entries(supplierGroups || {}).map(([supplier_name, data]) => ({
        supplier_name,
        total_spent: data.total_spent,
        movement_count: data.movement_count,
        avg_cost: data.total_spent / data.movement_count
      }));

      // Cost trends by month
      const monthGroups = movements?.reduce((acc, movement) => {
        const month = format(new Date(movement.movement_date), 'yyyy-MM');
        if (!acc[month]) {
          acc[month] = { total_cost: 0, movement_count: 0 };
        }
        acc[month].total_cost += movement.total_cost || 0;
        acc[month].movement_count++;
        return acc;
      }, {} as Record<string, { total_cost: number; movement_count: number }>);

      const costTrends = Object.entries(monthGroups || {})
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalInventoryValue,
        averageUnitCost,
        costByCategory,
        supplierAnalysis,
        costTrends
      };
    }
  });
};

export const usePredictiveAnalysis = (filters?: InventoryReportFilters) => {
  return useQuery({
    queryKey: ['predictive-analysis', filters],
    queryFn: async (): Promise<PredictiveAnalysisData> => {
      // Get consumption data from last 6 months
      const sixMonthsAgo = format(subMonths(businessClock.todayDate(), 6), 'yyyy-MM-dd');
      
      const entityLocationIds = await getReportLocationIdsForEntity(filters?.entityFilter);
      if (entityLocationIds && entityLocationIds.length === 0) {
        return {
          consumptionPatterns: [],
          seasonalTrends: [],
          craneConsumption: [],
        };
      }

      let movementsQuery = supabase
        .from('inventory_movements')
        .select(PREDICTIVE_MOVEMENTS_SELECT)
        .eq('movement_type', 'exit')
        .gte('movement_date', sixMonthsAgo)
        .eq('status', 'active');

      if (filters?.locationId) {
        movementsQuery = movementsQuery.or(`location_id.eq.${filters.locationId},destination_location_id.eq.${filters.locationId}`);
      } else if (entityLocationIds) {
        movementsQuery = applyReportMovementLocationFilter(movementsQuery, entityLocationIds);
      }

      const { data: movements, error } = await movementsQuery;

      if (error) throw error;

      // Get current stock
      let stockQuery = supabase
        .from('inventory_stock')
        .select(PREDICTIVE_STOCK_SELECT);

      if (filters?.locationId) {
        stockQuery = stockQuery.eq('location_id', filters.locationId);
      } else if (entityLocationIds) {
        stockQuery = stockQuery.in('location_id', entityLocationIds);
      }

      const { data: stockData, error: stockError } = await stockQuery;

      if (stockError) throw stockError;

      // Calculate consumption patterns
      const itemConsumption = movements?.reduce((acc, movement) => {
        const itemName = movement.inventory_items?.name || 'Unknown';
        if (!acc[itemName]) {
          acc[itemName] = { total_consumed: 0, months: new Set() };
        }
        acc[itemName].total_consumed += movement.quantity || 0;
        acc[itemName].months.add(format(new Date(movement.movement_date), 'yyyy-MM'));
        return acc;
      }, {} as Record<string, { total_consumed: number; months: Set<string> }>);

      const consumptionPatterns = Object.entries(itemConsumption || {}).map(([item_name, data]) => {
        const monthsActive = data.months.size || 1;
        const avg_monthly_consumption = data.total_consumed / monthsActive;
        const currentStock = stockData?.find(s => s.inventory_items?.name === item_name)?.current_quantity || 0;
        const days_until_stockout = avg_monthly_consumption > 0 ? (currentStock / avg_monthly_consumption) * 30 : 999;
        const recommended_reorder = Math.max(avg_monthly_consumption * 2, 10); // 2 months safety stock

        return {
          item_name,
          avg_monthly_consumption,
          current_stock: currentStock,
          days_until_stockout,
          recommended_reorder
        };
      }).filter(item => item.avg_monthly_consumption > 0);

      // Seasonal trends
      const monthlyConsumption = movements?.reduce((acc, movement) => {
        const month = format(new Date(movement.movement_date), 'yyyy-MM');
        const category = movement.inventory_items?.inventory_categories?.name || 'Sin categoría';
        
        if (!acc[month]) {
          acc[month] = { total_consumption: 0, categories: {} };
        }
        if (!acc[month].categories[category]) {
          acc[month].categories[category] = 0;
        }
        
        acc[month].total_consumption += movement.quantity || 0;
        acc[month].categories[category] += movement.quantity || 0;
        return acc;
      }, {} as Record<string, { total_consumption: number; categories: Record<string, number> }>);

      const seasonalTrends = Object.entries(monthlyConsumption || {}).map(([month, data]) => ({
        month,
        total_consumption: data.total_consumption,
        category_breakdown: Object.entries(data.categories).map(([category, consumption]) => ({
          category,
          consumption
        }))
      }));

      // Crane consumption analysis
      const craneConsumption = movements?.reduce((acc, movement) => {
        const cranePlate = movement.cranes?.license_plate || 'Sin grúa';
        const itemName = movement.inventory_items?.name || 'Unknown';
        
        if (!acc[cranePlate]) {
          acc[cranePlate] = { total_consumption: 0, items: {} };
        }
        if (!acc[cranePlate].items[itemName]) {
          acc[cranePlate].items[itemName] = 0;
        }
        
        acc[cranePlate].total_consumption += movement.quantity || 0;
        acc[cranePlate].items[itemName] += movement.quantity || 0;
        return acc;
      }, {} as Record<string, { total_consumption: number; items: Record<string, number> }>);

      const craneConsumptionData = Object.entries(craneConsumption || {}).map(([crane_license_plate, data]) => ({
        crane_license_plate,
        total_consumption: data.total_consumption,
        avg_monthly: data.total_consumption / 6, // 6 months of data
        top_items: Object.entries(data.items)
          .map(([item_name, quantity]) => ({ item_name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5)
      }));

      return {
        consumptionPatterns,
        seasonalTrends,
        craneConsumption: craneConsumptionData
      };
    }
  });
};
