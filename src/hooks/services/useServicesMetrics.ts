import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { start: weekStart, end: now };
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now };
      case 'all':
      default:
        return null;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRange(dateFilter);
      
      // Fetch services
      let servicesQuery = supabase
        .from('services')
        .select('id, value, service_date, status');
      
      if (dateRange) {
        servicesQuery = servicesQuery
          .gte('service_date', dateRange.start.toISOString().split('T')[0])
          .lte('service_date', dateRange.end.toISOString().split('T')[0]);
      }
      
      const { data: servicesData, error: servicesError } = await servicesQuery;
      
      if (servicesError) throw servicesError;
      
      setServices(servicesData || []);
      
      // Fetch costs related to services
      let costsQuery = supabase
        .from('costs')
        .select('amount, date, service_id')
        .not('service_id', 'is', null);
      
      if (dateRange) {
        costsQuery = costsQuery
          .gte('date', dateRange.start.toISOString().split('T')[0])
          .lte('date', dateRange.end.toISOString().split('T')[0]);
      }
      
      const { data: costsData, error: costsError } = await costsQuery;
      
      if (costsError) throw costsError;
      
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

  const metrics = useMemo((): ServicesMetrics => {
    const totalServices = services.length;
    const totalRevenue = services.reduce((sum, service) => sum + (service.value || 0), 0);
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