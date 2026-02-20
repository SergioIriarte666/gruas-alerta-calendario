import { useState, useEffect, useMemo } from 'react';
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

  const getDateFilterInfo = (filter: DateFilter) => {
    const currentChileDate = getCurrentChileDate();
    const currentChileDateString = getCurrentChileDateString();
    
    switch (filter) {
      case 'today':
        console.log('📅 Filtro TODAY aplicado:', currentChileDateString);
        return { 
          type: 'exact', 
          date: currentChileDateString 
        };
      case 'week':
        const weekRange = getCurrentWeekRange();
        const weekStartString = formatForDatabase(weekRange.start);
        const weekEndString = formatForDatabase(weekRange.end);
        console.log('📅 Filtro WEEK aplicado desde:', weekStartString, 'hasta:', weekEndString, '(lunes a domingo)');
        return { 
          type: 'range', 
          start: weekStartString, 
          end: weekEndString 
        };
      case 'month':
        const monthRange = getCurrentMonthRange();
        const monthStartString = formatForDatabase(monthRange.start);
        const monthEndString = formatForDatabase(monthRange.end);
        console.log('📅 Filtro MONTH aplicado desde:', monthStartString, 'hasta:', monthEndString);
        return { 
          type: 'range', 
          start: monthStartString, 
          end: monthEndString 
        };
      case 'all':
      default:
        console.log('📅 Filtro ALL aplicado: sin restricciones de fecha');
        return null;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateFilterInfo = getDateFilterInfo(dateFilter);
      
      // Fetch services
      let servicesQuery = supabase
        .from('services')
        .select('id, value, custody_total_amount, service_date, status');
      
      if (dateFilterInfo) {
        if (dateFilterInfo.type === 'exact') {
          // Para "today", usar comparación exacta
          servicesQuery = servicesQuery.eq('service_date', dateFilterInfo.date);
        } else if (dateFilterInfo.type === 'range') {
          // Para "week" y "month", usar rango
          servicesQuery = servicesQuery
            .gte('service_date', dateFilterInfo.start)
            .lte('service_date', dateFilterInfo.end);
        }
      }
      
      const { data: servicesData, error: servicesError } = await servicesQuery;
      
      if (servicesError) throw servicesError;
      
      console.log(`🔍 Servicios encontrados para filtro "${dateFilter}":`, servicesData?.length || 0);
      setServices(servicesData || []);
      
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
      
      console.log(`💰 Costos encontrados para filtro "${dateFilter}":`, costsData?.length || 0);
      setCosts(costsData || []);
      
    } catch (error) {
      console.error('Error fetching services metrics:', error);
      toast.error('Error al cargar las métricas de servicios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  // Escuchar evento global de refresh para actualizar metricas
  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log('🔄 [ServicesMetrics] Global refresh detectado, actualizando metricas...');
      fetchData();
    };
    
    window.addEventListener('global-data-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('global-data-refresh', handleGlobalRefresh);
  }, [dateFilter]);

  const metrics = useMemo((): ServicesMetrics => {
    const activeServices = services.filter(s => s.status !== 'cancelled');
    const totalServices = activeServices.length;
    const totalRevenue = activeServices.reduce((sum, service) => sum + getDisplayServiceValue(service), 0);
    const totalCosts = costs.reduce((sum, cost) => sum + (cost.amount || 0), 0);
    const netProfit = totalRevenue - totalCosts;
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