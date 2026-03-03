
import { useQuery } from '@tanstack/react-query';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

interface UseClosuresForInvoicesProps {
  includeInvoiced?: boolean;
}

export interface ClosureWithClient extends ServiceClosure {
  clientName?: string;
}

const MAX_CLOSURES_FOR_INVOICES = 500;

export const useClosuresForInvoices = (options: UseClosuresForInvoicesProps = {}) => {
  const { includeInvoiced = false } = options;

  const { data: closures = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['closures-for-invoices', includeInvoiced],
    queryFn: async () => {
      try {
        // 1. Fetch closures
        let query = supabase
          .from('service_closures')
          .select(`
            *,
            closure_services (
              service_id
            ),
            clients:client_id (
              name
            )
          `);

        if (includeInvoiced) {
          query = query.in('status', ['closed', 'invoiced', 'open']);
        } else {
          query = query.in('status', ['closed', 'open']);
        }

        const { data: closuresData, error: closuresError } = await query
          .order('created_at', { ascending: false })
          .limit(MAX_CLOSURES_FOR_INVOICES);

        if (closuresError) {
          if (closuresError.message.includes('permission denied') || closuresError.message.includes('row-level security')) {
            toast.error("Permisos insuficientes", {
              description: "No tienes permisos para ver los cierres. Contacta a un administrador.",
            });
            return [];
          }
          throw closuresError;
        }

        const formattedClosures: ClosureWithClient[] = (closuresData || []).map(data => ({
          ...formatClosureData(data),
          clientName: (data.clients as any)?.name || ''
        }));

        // 2. Filter out invoiced closures if not in edit mode
        if (!includeInvoiced) {
          if (formattedClosures.length === 0) return [];

          const allClosureIds = formattedClosures.map(closure => closure.id);

          const { data: invoicedClosures, error: invoicedError } = await supabase
            .from('invoice_closures')
            .select('closure_id')
            .in('closure_id', allClosureIds);

          if (invoicedError && !invoicedError.message.includes('permission denied')) {
            console.error('Error fetching invoiced closures:', invoicedError);
            // On error, we might return all closures or empty. 
            // Returning all might show already invoiced ones. Safe to return all for now or handle error.
            return formattedClosures; 
          }

          const invoicedClosureIds = new Set(
            invoicedClosures?.map(ic => ic.closure_id) || []
          );

          return formattedClosures.filter(
            closure => !invoicedClosureIds.has(closure.id)
          );
        }

        return formattedClosures;
      } catch (error: any) {
        if (!error.message?.includes('permission denied')) {
          toast.error("Error", {
            description: "No se pudieron cargar los cierres disponibles para facturación.",
          });
        }
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  return {
    closures,
    loading,
    refetch
  };
};
