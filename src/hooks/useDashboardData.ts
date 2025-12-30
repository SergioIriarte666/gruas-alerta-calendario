
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardMetrics, Service, CalendarEvent } from '@/types';
import { getCurrentMonthRange, isFutureDate, isCurrentMonth, parseFromDatabase } from '@/utils/timezoneUtils';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { getCachedData } from '@/services/offlineDataCache';
import { useOfflineModeOptional } from '@/contexts/OfflineModeContext';

const getPreviousMonthRange = () => {
  const now = new Date();
  const currentDayOfMonth = now.getDate();
  const previousMonth = subMonths(now, 1);
  const start = startOfMonth(previousMonth);
  const end = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), currentDayOfMonth);
  return { start, end };
};

// Check if we're effectively online
const checkIsOnline = (): boolean => {
  try {
    const forceOffline = localStorage.getItem('tms-force-offline-mode') === 'true';
    return navigator.onLine && !forceOffline;
  } catch {
    return navigator.onLine;
  }
};

// Fetch dashboard data from cache (offline)
const fetchDashboardDataFromCache = async (): Promise<{
  metrics: DashboardMetrics;
  recentServices: Service[];
  upcomingEvents: CalendarEvent[];
} | null> => {
  try {
    console.log('[Dashboard] Fetching data from offline cache...');
    
    // Get services from cache
    const cachedServices = await getCachedData<any>('services');
    
    if (!cachedServices || cachedServices.length === 0) {
      console.log('[Dashboard] No cached services found');
      return null;
    }
    
    // Get clients for mapping
    const cachedClients = await getCachedData<any>('clients');
    const clientsMap = new Map(cachedClients.map(c => [c.id, c]));
    
    // Transform services
    const services: Service[] = cachedServices.map((s: any) => ({
      ...s,
      serviceDate: s.service_date,
      vehicleBrand: s.vehicle_brand,
      vehicleModel: s.vehicle_model,
      licensePlate: s.license_plate,
      client: clientsMap.get(s.client_id) || { id: s.client_id || '', name: 'N/A' },
    }));
    
    const recentServices = services.slice(0, 5);
    
    const servicesThisMonth = services.filter(s => isCurrentMonth(s.serviceDate));
    const monthlyServices = servicesThisMonth.length;
    const monthlyRevenue = servicesThisMonth.reduce((sum, s) => sum + (s.value || 0), 0);
    
    const futureServices = services.filter(s => isFutureDate(s.serviceDate)).length;
    
    const { start: prevStart, end: prevEnd } = getPreviousMonthRange();
    const servicesPreviousMonth = services.filter(s => {
      const serviceDate = new Date(s.serviceDate);
      return serviceDate >= prevStart && serviceDate <= prevEnd;
    });
    const previousMonthServices = servicesPreviousMonth.length;
    const previousMonthRevenue = servicesPreviousMonth.reduce((sum, s) => sum + (s.value || 0), 0);
    
    const servicesChange = previousMonthServices > 0 
      ? ((monthlyServices - previousMonthServices) / previousMonthServices) * 100
      : monthlyServices > 0 ? 100 : 0;
    
    const revenueChange = previousMonthRevenue > 0
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : monthlyRevenue > 0 ? 100 : 0;
    
    const servicesByStatus = services.reduce((acc, service) => {
      const status = service.status || 'pending';
      if (status === 'pending' || status === 'in_progress') {
        acc.pending++;
      } else if (status === 'completed') {
        acc.completed++;
      } else if (status === 'cancelled') {
        acc.cancelled++;
      }
      return acc;
    }, { pending: 0, completed: 0, cancelled: 0 });
    
    const metrics: DashboardMetrics = {
      totalServices: services.length,
      monthlyServices,
      futureServices,
      monthlyRevenue,
      pendingInvoices: 0, // Not available offline
      overdueInvoices: 0, // Not available offline
      servicesByStatus,
      upcomingExpirations: 0,
      previousMonthServices,
      previousMonthRevenue,
      servicesChange,
      revenueChange,
    };
    
    console.log('[Dashboard] Cache data loaded successfully');
    return { metrics, recentServices, upcomingEvents: [] };
  } catch (error) {
    console.error('[Dashboard] Error loading from cache:', error);
    return null;
  }
};

// Fetch dashboard data from Supabase (online)
const fetchDashboardDataFromSupabase = async () => {
  const { start: startDate, end: endDate } = getCurrentMonthRange();

  const [
    servicesRes,
    invoicesRes,
    pendingInvoicesRes
  ] = await Promise.all([
    supabase.from('services').select(`
      id,
      folio,
      service_date,
      client:clients!services_client_id_fkey(id, name),
      vehicle_brand,
      vehicle_model,
      license_plate,
      value,
      status
    `).order('service_date', { ascending: false }),
    supabase.from('invoices').select('id, folio, due_date').eq('status', 'overdue'),
    supabase.from('invoices').select('id', { count: 'exact' }).eq('status', 'draft')
  ]);

  if (servicesRes.error) throw new Error(`Services Error: ${servicesRes.error.message}`);
  if (invoicesRes.error) throw new Error(`Invoices Error: ${invoicesRes.error.message}`);
  if (pendingInvoicesRes.error) throw new Error(`Pending Invoices Error: ${pendingInvoicesRes.error.message}`);

  const services: Service[] = (servicesRes.data || []).map((s: any) => ({
      ...s,
      serviceDate: s.service_date,
      vehicleBrand: s.vehicle_brand,
      vehicleModel: s.vehicle_model,
      licensePlate: s.license_plate,
      client: s.client || {id: '', name: 'N/A'},
  })) as Service[];
  
  const recentServices = services.slice(0, 5);

  const servicesThisMonth = services.filter(s => isCurrentMonth(s.serviceDate));
  const monthlyServices = servicesThisMonth.length;
  const monthlyRevenue = servicesThisMonth.reduce((sum, s) => sum + s.value, 0);
  
  const futureServices = services.filter(s => isFutureDate(s.serviceDate)).length;

  const { start: prevStart, end: prevEnd } = getPreviousMonthRange();
  const servicesPreviousMonth = services.filter(s => {
    const serviceDate = new Date(s.serviceDate);
    return serviceDate >= prevStart && serviceDate <= prevEnd;
  });
  const previousMonthServices = servicesPreviousMonth.length;
  const previousMonthRevenue = servicesPreviousMonth.reduce((sum, s) => sum + s.value, 0);

  const servicesChange = previousMonthServices > 0 
    ? ((monthlyServices - previousMonthServices) / previousMonthServices) * 100
    : monthlyServices > 0 ? 100 : 0;
  
  const revenueChange = previousMonthRevenue > 0
    ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : monthlyRevenue > 0 ? 100 : 0;
  
  const overdueInvoices = invoicesRes.data?.length ?? 0;

  const servicesByStatus = services.reduce((acc, service) => {
    const status = service.status || 'pending';
    if (status === 'pending' || status === 'in_progress') {
      acc.pending++;
    } else if (status === 'completed') {
      acc.completed++;
    } else if (status === 'cancelled') {
      acc.cancelled++;
    }
    return acc;
  }, { pending: 0, completed: 0, cancelled: 0 });

  const metrics: DashboardMetrics = {
    totalServices: services.length,
    monthlyServices,
    futureServices,
    monthlyRevenue,
    pendingInvoices: pendingInvoicesRes.count ?? 0,
    overdueInvoices,
    servicesByStatus,
    upcomingExpirations: 0,
    previousMonthServices,
    previousMonthRevenue,
    servicesChange,
    revenueChange,
  };

  const upcomingEvents: CalendarEvent[] = [];
  (invoicesRes.data || []).forEach((invoice: any) => {
    upcomingEvents.push({
      id: `invoice-${invoice.id}`,
      title: `Factura ${invoice.folio} vencida`,
      date: invoice.due_date,
      type: 'invoice_due',
      status: 'urgent',
      entityId: invoice.id,
      entityType: 'invoice',
    });
  });
  
  return { metrics, recentServices, upcomingEvents };
};

export const useDashboardData = () => {
  const queryClient = useQueryClient();
  const offlineContext = useOfflineModeOptional();
  
  const { data, isLoading: loading, error, isError } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const isOnline = checkIsOnline();
      
      // If offline, try to load from cache
      if (!isOnline) {
        console.log('[Dashboard] Offline mode - loading from cache');
        const cachedData = await fetchDashboardDataFromCache();
        if (cachedData) {
          return { ...cachedData, isOfflineData: true };
        }
        // Return empty metrics if no cache
        return {
          metrics: null,
          recentServices: [],
          upcomingEvents: [],
          isOfflineData: true,
          noCache: true
        };
      }
      
      // Online - fetch from Supabase
      try {
        const result = await fetchDashboardDataFromSupabase();
        return { ...result, isOfflineData: false };
      } catch (error) {
        console.error('[Dashboard] Online fetch failed, trying cache:', error);
        // If online fetch fails, try cache as fallback
        const cachedData = await fetchDashboardDataFromCache();
        if (cachedData) {
          return { ...cachedData, isOfflineData: true };
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!checkIsOnline()) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    // Only set up realtime if online
    if (!checkIsOnline()) return;
    
    const handleChanges = (payload: any) => {
      console.log('Real-time change received:', payload);
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
    };

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs' }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, handleChanges)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, offlineContext?.effectiveIsOnline]);

  if (error && !data) {
    console.error('Error loading dashboard data:', error);
  }

  return {
    metrics: data?.metrics ?? null,
    recentServices: data?.recentServices ?? [],
    upcomingEvents: data?.upcomingEvents ?? [],
    loading,
    isOfflineData: data?.isOfflineData ?? false,
    noCache: (data as any)?.noCache ?? false,
  };
};
