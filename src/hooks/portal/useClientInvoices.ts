import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Database } from '@/integrations/supabase/types';

export type ClientInvoice = Pick<
  Database['public']['Tables']['invoices']['Row'],
  'id' | 'folio' | 'issue_date' | 'due_date' | 'total' | 'status'
>;

const fetchClientInvoices = async (userId: string | undefined): Promise<ClientInvoice[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('id, folio, issue_date, due_date, total, status')
    // RLS in Supabase ensures that only the invoices belonging to the
    // authenticated client are returned.
    .order('issue_date', { ascending: false });

  if (error) {
    console.error('Error fetching client invoices:', error);
    throw new Error('No se pudieron obtener las facturas.');
  }

  return data || [];
};

export const useClientInvoices = () => {
  const { user } = useUser();

  return useQuery<ClientInvoice[], Error>({
    queryKey: ['clientInvoices', user?.id],
    queryFn: () => fetchClientInvoices(user?.id),
    enabled: !!user,
  });
};

