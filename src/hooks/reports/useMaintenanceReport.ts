
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("useMaintenanceReport");
export interface MaintenanceReportFilters {
  dateFrom: string;
  dateTo: string;
  craneId?: string;
  maintenanceType?: string;
  status?: string;
  provider?: string;
}

export interface MaintenanceReportData {
  totalMaintenanceCost: number;
  totalPartsCost: number;
  totalInterventions: number;
  averageMaintenanceCost: number;
  topProviders: Array<{
    provider: string;
    totalCost: number;
    interventionCount: number;
  }>;
  craneAnalysis: Array<{
    craneId: string;
    licensePlate: string;
    brand: string;
    model: string;
    totalMaintenanceCost: number;
    totalPartsCost: number;
    interventionCount: number;
    costPerKm?: number;
    lastMaintenance?: string;
    nextMaintenance?: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    maintenanceCost: number;
    partsCost: number;
    interventionCount: number;
  }>;
  maintenanceByType: Array<{
    type: string;
    count: number;
    cost: number;
  }>;
  partsAnalysis: Array<{
    partName: string;
    supplier: string;
    quantity: number;
    totalCost: number;
    craneCount: number;
  }>;
  predictiveInsights: {
    highCostCranes: Array<{
      craneId: string;
      licensePlate: string;
      totalCost: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    }>;
    frequentIssues: Array<{
      issue: string;
      frequency: number;
      avgCost: number;
    }>;
  };
}

const defaultFilters: MaintenanceReportFilters = {
  dateFrom: format(new Date(businessClock.todayDate().getFullYear(), 0, 1), 'yyyy-MM-dd'),
  dateTo: businessClock.today(),
};

export const useMaintenanceReport = (filters: MaintenanceReportFilters = defaultFilters) => {
  const [data, setData] = useState<MaintenanceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMaintenanceReport = async () => {
      try {
        setLoading(true);
        setError(null);

        logger.debug('🔍 Fetching maintenance report with filters:', filters);

        // Build maintenance query
        let maintenanceQuery = supabase
          .from('crane_maintenance')
          .select(`
            *,
            cranes:crane_id (
              license_plate,
              brand,
              model
            )
          `)
          .or(`completed_date.gte.${filters.dateFrom},scheduled_date.gte.${filters.dateFrom}`)
          .or(`completed_date.lte.${filters.dateTo},scheduled_date.lte.${filters.dateTo}`);

        if (filters.craneId) {
          maintenanceQuery = maintenanceQuery.eq('crane_id', filters.craneId);
        }
        if (filters.maintenanceType) {
          maintenanceQuery = maintenanceQuery.ilike('maintenance_type', `%${filters.maintenanceType}%`);
        }
        if (filters.status) {
          maintenanceQuery = maintenanceQuery.eq('status', filters.status);
        }
        if (filters.provider) {
          maintenanceQuery = maintenanceQuery.ilike('provider', `%${filters.provider}%`);
        }

        const { data: maintenanceData, error: maintenanceError } = await maintenanceQuery;

        if (maintenanceError) throw maintenanceError;

        logger.debug('📊 Maintenance data found:', maintenanceData?.length || 0, 'records');

        // Build parts query (direct parts)
        let partsQuery = supabase
          .from('crane_parts')
          .select(`
            *,
            cranes:crane_id (
              license_plate,
              brand,
              model
            )
          `)
          .gte('date', filters.dateFrom)
          .lte('date', filters.dateTo);

        if (filters.craneId) {
          partsQuery = partsQuery.eq('crane_id', filters.craneId);
        }

        const { data: directPartsData, error: partsError } = await partsQuery;

        if (partsError) throw partsError;

        // Build cost-derived parts query
        let costPartsQuery = supabase
          .from('costs')
          .select(`
            *,
            cranes:crane_id (
              license_plate,
              brand,
              model
            ),
            cost_categories!inner(name)
          `)
          .eq('subcategory', 'Piezas y Repuestos')
          .gte('date', filters.dateFrom)
          .lte('date', filters.dateTo);

        if (filters.craneId) {
          costPartsQuery = costPartsQuery.eq('crane_id', filters.craneId);
        }

        const { data: costPartsData, error: costPartsError } = await costPartsQuery;

        if (costPartsError) throw costPartsError;

        // Get cost_ids that are already associated with crane_parts to avoid duplication
        const associatedCostIds = new Set(
          directPartsData?.filter(part => part.cost_id).map(part => part.cost_id) || []
        );

        // Transform cost parts to match parts structure, excluding those already in crane_parts
        const transformedCostParts = costPartsData
          ?.filter(cost => !associatedCostIds.has(cost.id))
          ?.map(cost => ({
            id: cost.id,
            crane_id: cost.crane_id,
            part_name: cost.description,
            supplier: cost.notes?.split(' - Proveedor: ')[1]?.split(' (Tel:')[0] || 'Sin proveedor',
            quantity: 1, // Default for costs
            unit_price: cost.amount,
            total_value: cost.amount,
            date: cost.date,
            cranes: cost.cranes,
            notes: cost.notes,
            phone: cost.notes?.includes('Tel:') ? cost.notes.split('Tel: ')[1]?.split(')')[0] : null,
            created_at: cost.created_at,
            updated_at: cost.updated_at,
            created_by: cost.created_by,
            cost_id: cost.id
          })) || [];

        // Combine both parts sources
        const partsData = [...(directPartsData || []), ...transformedCostParts];

        logger.debug('🔧 Direct parts found:', directPartsData?.length || 0, 'records');
        logger.debug('🔧 Cost-derived parts found:', transformedCostParts.length, 'records');
        logger.debug('🔧 Total parts data:', partsData.length, 'records');
        if (partsData && partsData.length > 0) {
          logger.debug('Parts sample:', partsData.slice(0, 3));
        }

        // Process data
        const totalMaintenanceCost = maintenanceData?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
        const totalPartsCost = partsData?.reduce((sum, item) => sum + (item.total_value || 0), 0) || 0;
        const totalInterventions = (maintenanceData?.length || 0) + (partsData?.length || 0);
        const averageMaintenanceCost = totalInterventions > 0 ? (totalMaintenanceCost + totalPartsCost) / totalInterventions : 0;

        // Top providers analysis
        const providerMap = new Map();
        maintenanceData?.forEach(item => {
          if (item.provider) {
            const existing = providerMap.get(item.provider) || { provider: item.provider, totalCost: 0, interventionCount: 0 };
            existing.totalCost += item.cost || 0;
            existing.interventionCount += 1;
            providerMap.set(item.provider, existing);
          }
        });

        partsData?.forEach(item => {
          if (item.supplier) {
            const existing = providerMap.get(item.supplier) || { provider: item.supplier, totalCost: 0, interventionCount: 0 };
            existing.totalCost += item.total_value || 0;
            existing.interventionCount += 1;
            providerMap.set(item.supplier, existing);
          }
        });

        const topProviders = Array.from(providerMap.values())
          .sort((a, b) => b.totalCost - a.totalCost)
          .slice(0, 10);

        // Crane analysis
        const craneMap = new Map();
        
        maintenanceData?.forEach(item => {
          if (item.crane_id && item.cranes) {
            const crane = craneMap.get(item.crane_id) || {
              craneId: item.crane_id,
              licensePlate: item.cranes.license_plate,
              brand: item.cranes.brand,
              model: item.cranes.model,
              totalMaintenanceCost: 0,
              totalPartsCost: 0,
              interventionCount: 0,
              lastMaintenance: null,
              nextMaintenance: null,
            };
            
            crane.totalMaintenanceCost += item.cost || 0;
            crane.interventionCount += 1;
            
            if (item.completed_date && (!crane.lastMaintenance || item.completed_date > crane.lastMaintenance)) {
              crane.lastMaintenance = item.completed_date;
            }
            
            if (item.next_maintenance_date && (!crane.nextMaintenance || item.next_maintenance_date < crane.nextMaintenance)) {
              crane.nextMaintenance = item.next_maintenance_date;
            }
            
            craneMap.set(item.crane_id, crane);
          }
        });

        partsData?.forEach(item => {
          if (item.crane_id && item.cranes) {
            const crane = craneMap.get(item.crane_id) || {
              craneId: item.crane_id,
              licensePlate: item.cranes.license_plate,
              brand: item.cranes.brand,
              model: item.cranes.model,
              totalMaintenanceCost: 0,
              totalPartsCost: 0,
              interventionCount: 0,
            };
            
            crane.totalPartsCost += item.total_value || 0;
            crane.interventionCount += 1;
            craneMap.set(item.crane_id, crane);
          }
        });

        const craneAnalysis = Array.from(craneMap.values());

        // Monthly trends
        const monthlyMap = new Map();
        
        const addToMonthly = (date: string, maintenanceCost: number, partsCost: number) => {
          const month = businessClock.format(date, 'yyyy-MM');
          const existing = monthlyMap.get(month) || { month, maintenanceCost: 0, partsCost: 0, interventionCount: 0 };
          existing.maintenanceCost += maintenanceCost;
          existing.partsCost += partsCost;
          existing.interventionCount += 1;
          monthlyMap.set(month, existing);
        };

        maintenanceData?.forEach(item => {
          // Use completed_date if available, otherwise fall back to scheduled_date or created_at
          const dateToUse = item.completed_date || item.scheduled_date || item.created_at;
          addToMonthly(dateToUse, item.cost || 0, 0);
        });

        partsData?.forEach(item => {
          addToMonthly(item.date, 0, item.total_value || 0);
        });

        const monthlyTrends = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

        // Maintenance by type
        const typeMap = new Map();
        maintenanceData?.forEach(item => {
          const existing = typeMap.get(item.maintenance_type) || { type: item.maintenance_type, count: 0, cost: 0 };
          existing.count += 1;
          existing.cost += item.cost || 0;
          typeMap.set(item.maintenance_type, existing);
        });

        const maintenanceByType = Array.from(typeMap.values());

        // Parts analysis
        const partsMap = new Map();
        partsData?.forEach(item => {
          const key = `${item.part_name}-${item.supplier}`;
          const existing = partsMap.get(key) || {
            partName: item.part_name,
            supplier: item.supplier,
            quantity: 0,
            totalCost: 0,
            craneCount: new Set(),
          };
          existing.quantity += item.quantity;
          existing.totalCost += item.total_value || 0;
          existing.craneCount.add(item.crane_id);
          partsMap.set(key, existing);
        });

        const partsAnalysis = Array.from(partsMap.values()).map(item => ({
          ...item,
          craneCount: item.craneCount.size,
        }));

        // Predictive insights
        const highCostCranes = craneAnalysis
          .sort((a, b) => (b.totalMaintenanceCost + b.totalPartsCost) - (a.totalMaintenanceCost + a.totalPartsCost))
          .slice(0, 5)
          .map(crane => ({
            craneId: crane.craneId,
            licensePlate: crane.licensePlate,
            totalCost: crane.totalMaintenanceCost + crane.totalPartsCost,
            trend: 'stable' as const, // Could be enhanced with time-series analysis
          }));

        const issueMap = new Map();
        maintenanceData?.forEach(item => {
          const existing = issueMap.get(item.description) || { issue: item.description, frequency: 0, totalCost: 0 };
          existing.frequency += 1;
          existing.totalCost += item.cost || 0;
          issueMap.set(item.description, existing);
        });

        const frequentIssues = Array.from(issueMap.values())
          .map(item => ({
            issue: item.issue,
            frequency: item.frequency,
            avgCost: item.totalCost / item.frequency,
          }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 10);

        const reportData: MaintenanceReportData = {
          totalMaintenanceCost,
          totalPartsCost,
          totalInterventions,
          averageMaintenanceCost,
          topProviders,
          craneAnalysis,
          monthlyTrends,
          maintenanceByType,
          partsAnalysis,
          predictiveInsights: {
            highCostCranes,
            frequentIssues,
          },
        };

        logger.debug('📈 Report summary:', {
          maintenanceRecords: maintenanceData?.length || 0,
          partsRecords: partsData?.length || 0,
          totalMaintenanceCost,
          totalPartsCost,
          partsAnalysisCount: partsAnalysis.length,
          craneAnalysisCount: craneAnalysis.length
        });

        setData(reportData);
      } catch (err) {
        logger.error('Error fetching maintenance report:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenanceReport();
  }, [filters]);

  return { data, loading, error };
};