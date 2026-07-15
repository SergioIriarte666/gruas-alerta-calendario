
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardMetrics, Service, CalendarEvent } from '@/types';
import { getCurrentMonthRange, isFutureDate, isCurrentMonth, toLocalDateString } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';
import { subMonths, startOfMonth } from 'date-fns';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useDashboardData");
const getPreviousMonthRange = () => {
  const now = businessClock.todayDate();
  const currentDayOfMonth = now.getDate(); // Día actual del mes (ej: 17)
  const previousMonth = subMonths(now, 1);
  const start = startOfMonth(previousMonth);
  // Comparar hasta el mismo día del mes anterior (comparación día a día)
  const end = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), currentDayOfMonth);
  return { start, end };
};

const fetchDashboardData = async () => {
  const { start: _startDate, end: _endDate } = getCurrentMonthRange();
  
  // Only fetch services from the last 2 months (current + previous) instead of ALL
  const twoMonthsAgo = subMonths(businessClock.todayDate(), 2);
  const queryStartDate = toLocalDateString(startOfMonth(twoMonthsAgo));

  const [
    servicesRes,
    totalServicesRes,
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
    `)
    .gte('service_date', queryStartDate)
    .order('service_date', { ascending: false }),
    // Separate count for total services (all time)
    supabase.from('services').select('id', { count: 'exact', head: true }),
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
  
  // Calcular servicios futuros usando utilidad centralizada
  const futureServices = services.filter(s => isFutureDate(s.serviceDate)).length;

  // Calcular métricas del mes anterior
  const { start: prevStart, end: prevEnd } = getPreviousMonthRange();
  const servicesPreviousMonth = services.filter(s => {
    const serviceDate = new Date(s.serviceDate);
    return serviceDate >= prevStart && serviceDate <= prevEnd;
  });
  const previousMonthServices = servicesPreviousMonth.length;
  const previousMonthRevenue = servicesPreviousMonth.reduce((sum, s) => sum + s.value, 0);

  // Calcular porcentajes de cambio
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
    totalServices: totalServicesRes.count ?? services.length,
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
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    const handleChanges = () => {
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
  }, [queryClient]);

  if (error) {
    logger.error('Error loading dashboard data:', error);
  }

  return {
    metrics: data?.metrics ?? null,
    recentServices: data?.recentServices ?? [],
    upcomingEvents: data?.upcomingEvents ?? [],
    loading,
  };
};
