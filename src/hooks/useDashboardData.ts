
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardMetrics, Service, CalendarEvent } from '@/types';
import { startOfMonth, endOfMonth } from 'date-fns';

const fetchDashboardData = async () => {
  const today = new Date();
  const startDate = startOfMonth(today);
  const endDate = endOfMonth(today);

  const [
    servicesRes,
    clientsRes,
    invoicesRes,
    pendingInvoicesRes
  ] = await Promise.all([
    supabase.from('services').select(`
      id,
      folio,
      service_date,
      client:clients(id, name),
      vehicle_brand,
      vehicle_model,
      license_plate,
      value,
      status
    `).order('service_date', { ascending: false }),
    supabase.from('clients').select('id', { count: 'exact' }).eq('is_active', true),
    supabase.from('invoices').select('id, folio, due_date').eq('status', 'overdue'),
    supabase.from('invoices').select('id', { count: 'exact' }).eq('status', 'draft')
  ]);

  if (servicesRes.error) throw new Error(`Services Error: ${servicesRes.error.message}`);
  if (clientsRes.error) throw new Error(`Clients Error: ${clientsRes.error.message}`);
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

  const servicesThisMonth = services.filter(s => {
    const serviceDate = new Date(s.serviceDate);
    return serviceDate >= startDate && serviceDate <= endDate;
  });

  const monthlyServices = servicesThisMonth.length;
  const monthlyRevenue = servicesThisMonth.reduce((sum, s) => sum + s.value, 0);
  const activeClients = clientsRes.count ?? 0;
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
    activeClients,
    monthlyRevenue,
    pendingInvoices: pendingInvoicesRes.count ?? 0,
    overdueInvoices,
    servicesByStatus,
    upcomingExpirations: 0,
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
  }, [queryClient]);

  if (error) {
    console.error('Error loading dashboard data:', error);
  }

  return {
    metrics: data?.metrics ?? null,
    recentServices: data?.recentServices ?? [],
    upcomingEvents: data?.upcomingEvents ?? [],
    loading,
  };
};
