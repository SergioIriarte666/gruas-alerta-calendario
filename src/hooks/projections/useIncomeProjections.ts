import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';

export interface ProjectedInvoice {
  id: string;
  folio: string;
  numero_fiscal: string | null;
  issue_date: string;
  due_date: string;
  total: number;
  remaining_amount: number;
  status: string;
  payment_term_id: string | null;
  client_id: string;
  client_name: string;
  client_rut: string;
  payment_term_name: string | null;
  payment_term_days: number | null;
  days_until_due: number;
  days_overdue: number;
}

export interface ProjectionMetrics {
  totalProjected30Days: number;
  totalOverdue: number;
  totalInCollection: number;
  collectionRate: number;
}

interface UseIncomeProjectionsParams {
  dateRange?: number; // días hacia adelante
  clientId?: string | null;
  status?: string[];
}

export const useIncomeProjections = (params: UseIncomeProjectionsParams = {}) => {
  const { dateRange = 30, clientId, status } = params;

  return useQuery({
    queryKey: ['income-projections', dateRange, clientId, status],
    queryFn: async () => {
      const today = new Date();
      const futureDate = addDays(today, dateRange);

      const validStatuses = (status || ['sent', 'partial', 'overdue']) as ('sent' | 'partial' | 'overdue')[];
      
      let query = supabase
        .from('invoices')
        .select(`
          id,
          folio,
          numero_fiscal,
          issue_date,
          due_date,
          total,
          remaining_amount,
          status,
          payment_term_id,
          client:clients(id, name, rut),
          payment_term:payment_terms(id, name, days)
        `)
        .in('status', validStatuses)
        .gt('remaining_amount', 0);

      if (clientId && clientId !== 'all') {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;

      // Formatear datos y calcular métricas
      const invoices: ProjectedInvoice[] = (data || []).map((invoice: any) => {
        const dueDate = new Date(invoice.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const daysOverdue = invoice.status === 'overdue' ? Math.abs(Math.min(daysUntilDue, 0)) : 0;

        return {
          id: invoice.id,
          folio: invoice.folio,
          numero_fiscal: invoice.numero_fiscal,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          total: Number(invoice.total),
          remaining_amount: Number(invoice.remaining_amount),
          status: invoice.status,
          payment_term_id: invoice.payment_term_id,
          client_id: invoice.client?.id || '',
          client_name: invoice.client?.name || 'Sin cliente',
          client_rut: invoice.client?.rut || '',
          payment_term_name: invoice.payment_term?.name || null,
          payment_term_days: invoice.payment_term?.days || null,
          days_until_due: daysUntilDue,
          days_overdue: daysOverdue,
        };
      });

      // Calcular métricas
      const totalProjected30Days = invoices
        .filter(inv => inv.days_until_due >= 0 && inv.days_until_due <= 30)
        .reduce((sum, inv) => sum + inv.remaining_amount, 0);

      const totalOverdue = invoices
        .filter(inv => inv.status === 'overdue')
        .reduce((sum, inv) => sum + inv.remaining_amount, 0);

      const totalInCollection = invoices
        .filter(inv => inv.status === 'sent' || inv.status === 'partial')
        .reduce((sum, inv) => sum + inv.remaining_amount, 0);

      // Calcular tasa de cobro (simplificado por ahora)
      const collectionRate = totalOverdue + totalInCollection > 0
        ? (totalInCollection / (totalOverdue + totalInCollection)) * 100
        : 100;

      const metrics: ProjectionMetrics = {
        totalProjected30Days,
        totalOverdue,
        totalInCollection,
        collectionRate,
      };

      return {
        invoices,
        metrics,
      };
    },
  });
};
