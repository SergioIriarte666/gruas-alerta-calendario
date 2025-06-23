
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type ClientInvoice = Pick<
  Database['public']['Tables']['invoices']['Row'],
  'id' | 'folio' | 'issue_date' | 'due_date' | 'total' | 'status'
>;

const fetchClientInvoices = async (userId: string | undefined): Promise<ClientInvoice[]> => {
  if (!userId) {
    console.log('No user ID provided for client invoices fetch');
    return [];
  }

  try {
    console.log('Fetching client invoices for user:', userId);

    const { data, error } = await supabase
      .from('invoices')
      .select('id, folio, issue_date, due_date, total, status')
      .order('issue_date', { ascending: false });

    if (error) {
      console.error('Error fetching client invoices:', error);
      throw new Error(`Error al obtener facturas: ${error.message}`);
    }

    console.log('Client invoices fetched successfully:', data?.length || 0, 'invoices');
    return data || [];
  } catch (error: any) {
    console.error('Unexpected error in fetchClientInvoices:', error);
    throw error;
  }
};

export const useClientInvoices = () => {
  const { user } = useUser();

  return useQuery<ClientInvoice[], Error>({
    queryKey: ['clientInvoices', user?.id],
    queryFn: () => fetchClientInvoices(user?.id),
    enabled: !!user,
    retry: (failureCount, error) => {
      console.log(`Client invoices query retry attempt ${failureCount}:`, error.message);
      if (error.message.includes('permission')) {
        toast.error('Error de permisos', {
          description: 'No tienes acceso a esta información. Contacta al administrador.',
        });
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    meta: {
      onError: (error: Error) => {
        console.error('Client invoices query error:', error);
        toast.error('Error al cargar facturas', {
          description: 'No se pudieron cargar tus facturas. Por favor, intenta recargar la página.',
        });
      },
    },
  });
};
