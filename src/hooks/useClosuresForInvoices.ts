
import { useQuery } from '@tanstack/react-query';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatClosureData } from '@/utils/closureUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useClosuresForInvoices");
interface UseClosuresForInvoicesProps {
  includeInvoiced?: boolean;
  enabled?: boolean;
}

export interface ClosureWithClient extends ServiceClosure {
  clientName?: string;
}

const MAX_CLOSURES_FOR_INVOICES = 100;

export const useClosuresForInvoices = (options: UseClosuresForInvoicesProps = {}) => {
  const { includeInvoiced = false, enabled = true } = options;

  const { data: closures = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['closures-for-invoices', includeInvoiced],
    enabled,
    queryFn: async () => {
      try {
        logger.debug('Fetching closures for invoices, includeInvoiced:', includeInvoiced);
        
        // Strategy: Fetch distinct sets to ensure we get relevant data without scanning everything
        // 1. Fetch OPEN closures (Active work)
        const { data: openClosures, error: openError } = await supabase
          .from('service_closures')
          .select(`
            id, folio, total, status, client_id, created_at, updated_at, date_from, date_to, purchase_order,
            clients:client_id ( name )
          `)
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (openError) throw openError;

        // 2. Fetch CLOSED closures (Ready for invoicing)
        // Limit to 50 to avoid performance issues
        const { data: closedClosures, error: closedError } = await supabase
          .from('service_closures')
          .select(`
            id, folio, total, status, client_id, created_at, updated_at, date_from, date_to, purchase_order,
            clients:client_id ( name )
          `)
          .eq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(50);

        if (closedError) throw closedError;

        let invoicedClosures: any[] = [];
        
        // 3. If editing, fetch specific invoiced closures or recent ones
        if (includeInvoiced) {
          const { data: invData, error: invError } = await supabase
            .from('service_closures')
            .select(`
              id, folio, total, status, client_id, created_at, updated_at, date_from, date_to, purchase_order,
              clients:client_id ( name )
            `)
            .eq('status', 'invoiced')
            .order('created_at', { ascending: false })
            .limit(20);
            
          if (invError) throw invError;
          invoicedClosures = invData || [];
        }

        // Combine all results
        const combinedData = [
          ...(openClosures || []),
          ...(closedClosures || []),
          ...invoicedClosures
        ];

        // Dedup by ID (just in case)
        const uniqueData = Array.from(new Map(combinedData.map(item => [item.id, item])).values());
        
        // Sort by creation date
        uniqueData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        logger.debug('Fetched closures count:', uniqueData.length);

        let formattedClosures: ClosureWithClient[] = uniqueData.map(data => ({
          ...formatClosureData(data),
          clientName: (data.clients as any)?.name || ''
        }));

        // 4. Filter out invoiced closures using a separate query to avoid relation ambiguity
        // Only if NOT explicitly including invoiced ones
        if (!includeInvoiced && formattedClosures.length > 0) {
          // Get IDs of closures that are already linked to invoices
          const closureIds = formattedClosures.map(c => c.id);
          
          if (closureIds.length > 0) {
            const { data: invoicedIds, error: invoiceError } = await supabase
              .from('invoice_closures')
              .select('closure_id')
              .in('closure_id', closureIds);
              
            if (invoiceError) {
              logger.error('Error fetching invoice_closures:', invoiceError);
            } else {
              const invoicedSet = new Set(invoicedIds?.map(i => i.closure_id) || []);
              const originalCount = formattedClosures.length;
              formattedClosures = formattedClosures.filter(c => !invoicedSet.has(c.id));
              logger.debug('Filtered invoiced closures:', originalCount - formattedClosures.length, 'removed');
            }
          }
        }

        return formattedClosures;
      } catch (error: any) {
        logger.error('Error fetching closures:', error);
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
