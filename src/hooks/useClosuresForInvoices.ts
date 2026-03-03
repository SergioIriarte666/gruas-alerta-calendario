
import { useQuery } from '@tanstack/react-query';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';

interface UseClosuresForInvoicesProps {
  includeInvoiced?: boolean;
  enabled?: boolean;
}

export interface ClosureWithClient extends ServiceClosure {
  clientName?: string;
}

const MAX_CLOSURES_FOR_INVOICES = 500;

export const useClosuresForInvoices = (options: UseClosuresForInvoicesProps = {}) => {
  const { includeInvoiced = false, enabled = true } = options;

  const { data: closures = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['closures-for-invoices', includeInvoiced],
    enabled,
    queryFn: async () => {
      try {
        // 1. Fetch closures basic data without nested relations that might cause ambiguity
        let query = supabase
          .from('service_closures')
          .select(`
            id, folio, total, status, client_id, created_at, updated_at, date_from, date_to, purchase_order,
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

        let formattedClosures: ClosureWithClient[] = (closuresData || []).map(data => ({
          ...formatClosureData(data),
          clientName: (data.clients as any)?.name || ''
        }));

        // 2. Filter out invoiced closures using a separate query to avoid relation ambiguity
        if (!includeInvoiced && formattedClosures.length > 0) {
          // Get IDs of closures that are already linked to invoices
          const closureIds = formattedClosures.map(c => c.id);
          
          const { data: invoicedIds, error: invoiceError } = await supabase
            .from('invoice_closures')
            .select('closure_id')
            .in('closure_id', closureIds);
            
          if (invoiceError) {
            console.error('Error fetching invoice_closures:', invoiceError);
            // We continue even if this fails, potentially showing invoiced closures
            // is better than showing nothing or crashing
          } else {
            const invoicedSet = new Set(invoicedIds?.map(i => i.closure_id) || []);
            formattedClosures = formattedClosures.filter(c => !invoicedSet.has(c.id));
          }
        }

        return formattedClosures;
      } catch (error: any) {
        console.error('Error fetching closures:', error);
        if (!error.message?.includes('permission denied')) {
          toast.error("Error al cargar cierres", {
            description: error.message || "No se pudieron cargar los cierres disponibles para facturación.",
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
