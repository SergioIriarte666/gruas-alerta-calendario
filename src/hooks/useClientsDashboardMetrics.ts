import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/types';

interface ClientMetrics {
  activeClients: number;
  inactiveClients: number;
  uniqueCompanies: number;
  activeServices: number;
  pendingInvoiceAmount: number;
}

const fetchServiceCounts = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('client_id, status')
    .in('status', ['pending', 'in_progress', 'completed']);
  if (error) throw error;
  return data || [];
};

const fetchPendingInvoices = async () => {
  const { data, error } = await supabase
    .from('invoices')
    .select('total, status, remaining_amount')
    .in('status', ['sent', 'overdue', 'partial'])
    .neq('status', 'cancelled');
  if (error) throw error;
  return data || [];
};

export const useClientsDashboardMetrics = (clients: Client[]) => {
  const { data: services = [] } = useQuery({
    queryKey: ['clients-dashboard-services'],
    queryFn: fetchServiceCounts,
    staleTime: 5 * 60 * 1000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['clients-dashboard-invoices'],
    queryFn: fetchPendingInvoices,
    staleTime: 5 * 60 * 1000,
  });

  const metrics = useMemo((): ClientMetrics => {
    const activeClients = clients.filter(c => c.isActive).length;
    const inactiveClients = clients.filter(c => !c.isActive).length;
    const uniqueRuts = new Set(clients.map(c => c.rut));
    const activeServices = services.length;
    const pendingInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.remaining_amount ?? inv.total ?? 0), 0);

    return {
      activeClients,
      inactiveClients,
      uniqueCompanies: uniqueRuts.size,
      activeServices,
      pendingInvoiceAmount,
    };
  }, [clients, services, invoices]);

  // Service count per client for the table column
  const serviceCountByClient = useMemo(() => {
    const map = new Map<string, number>();
    services.forEach(s => {
      if (s.client_id) {
        map.set(s.client_id, (map.get(s.client_id) || 0) + 1);
      }
    });
    return map;
  }, [services]);

  return { metrics, serviceCountByClient };
};
