import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  getCurrentChileDate, 
  getCurrentChileDateString, 
  getCurrentMonthRange,
  getCurrentWeekRange,
  formatForDatabase
} from '@/utils/timezoneUtils';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServicesMetrics');

export interface ServicesMetrics {
  totalServices: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  averageServiceValue: number;
  averageCostPerService: number;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';

export const useServicesMetrics = (dateFilter: DateFilter = 'all') => {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);

  const getDateFilterInfo = useCallback((filter: DateFilter) => {
    const currentChileDate = getCurrentChileDate();
    const currentChileDateString = getCurrentChileDateString();
    
    switch (filter) {
      case 'today':
        logger.debug('📅 Filtro TODAY aplicado:', currentChileDateString);
        return { 
          type: 'exact', 
          date: currentChileDateString 
        };
      case 'week': {
        const weekRange = getCurrentWeekRange();
        const weekStartString = formatForDatabase(weekRange.start);
        const weekEndString = formatForDatabase(weekRange.end);
        logger.debug('📅 Filtro WEEK aplicado desde:', weekStartString, 'hasta:', weekEndString, '(lunes a domingo)');
        return { 
          type: 'range', 
          start: weekStartString, 
          end: weekEndString 
        };
      }
      case 'month': {
        const monthRange = getCurrentMonthRange();
        const monthStartString = formatForDatabase(monthRange.start);
        const monthEndString = formatForDatabase(monthRange.end);
        logger.debug('📅 Filtro MONTH aplicado desde:', monthStartString, 'hasta:', monthEndString);
        return { 
          type: 'range', 
          start: monthStartString, 
          end: monthEndString 
        };
      }
      case 'all':
      default:
        logger.debug('📅 Filtro ALL aplicado: sin restricciones de fecha');
        return null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const dateFilterInfo = getDateFilterInfo(dateFilter);
      
      // Fetch services
      // Fetch all services using pagination to avoid 1000-row limit
      const allServices: any[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;
      
      while (true) {
        let servicesQuery = supabase
          .from('services')
          .select('id, value, custody_total_amount, service_date, status');
        
        if (dateFilterInfo) {
          if (dateFilterInfo.type === 'exact') {
            servicesQuery = servicesQuery.eq('service_date', dateFilterInfo.date);
          } else if (dateFilterInfo.type === 'range') {
            servicesQuery = servicesQuery
              .gte('service_date', dateFilterInfo.start)
              .lte('service_date', dateFilterInfo.end);
          }
        }
        
        const { data: servicesData, error: servicesError } = await servicesQuery
          .range(from, from + PAGE_SIZE - 1);
        
        if (servicesError) throw servicesError;
        if (!servicesData || servicesData.length === 0) break;
        
        allServices.push(...servicesData);
        if (servicesData.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      
      logger.debug(`🔍 Servicios encontrados para filtro "${dateFilter}":`, allServices.length);
      setServices(allServices);
      
      // Fetch costs related to services
      let costsQuery = supabase
        .from('costs')
        .select('amount, date, service_id')
        .not('service_id', 'is', null);
      
      if (dateFilterInfo) {
        if (dateFilterInfo.type === 'exact') {
          // Para "today", usar comparación exacta
          costsQuery = costsQuery.eq('date', dateFilterInfo.date);
        } else if (dateFilterInfo.type === 'range') {
          // Para "week" y "month", usar rango
          costsQuery = costsQuery
            .gte('date', dateFilterInfo.start)
            .lte('date', dateFilterInfo.end);
        }
      }
      
      const { data: costsData, error: costsError } = await costsQuery;
      
      if (costsError) throw costsError;
      
      logger.debug(`💰 Costos encontrados para filtro "${dateFilter}":`, costsData?.length || 0);
      setCosts(costsData || []);
      
    } catch (error) {
      logger.error('Error fetching services metrics:', error);
      toast.error('Error al cargar las métricas de servicios');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, getDateFilterInfo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Escuchar evento global de refresh para actualizar metricas
  useEffect(() => {
    const handleGlobalRefresh = () => {
      logger.debug('🔄 [ServicesMetrics] Global refresh detectado, actualizando metricas...');
      fetchData();
    };
    
    window.addEventListener('global-data-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('global-data-refresh', handleGlobalRefresh);
  }, [fetchData]);

  const metrics = useMemo((): ServicesMetrics => {
    const activeServices = services.filter(s => s.status !== 'cancelled');
    const totalServices = activeServices.length;
    const totalRevenue = Math.round(activeServices.reduce((sum, service) => sum + getDisplayServiceValue(service), 0));
    const totalCosts = Math.round(costs.reduce((sum, cost) => sum + (cost.amount || 0), 0));
    const netProfit = Math.round(totalRevenue - totalCosts);
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const averageServiceValue = totalServices > 0 ? totalRevenue / totalServices : 0;
    const averageCostPerService = totalServices > 0 ? totalCosts / totalServices : 0;

    return {
      totalServices,
      totalRevenue,
      totalCosts,
      netProfit,
      profitMargin,
      averageServiceValue,
      averageCostPerService,
    };
  }, [services, costs]);

  return {
    metrics,
    loading,
    refetch: fetchData,
  };
};
