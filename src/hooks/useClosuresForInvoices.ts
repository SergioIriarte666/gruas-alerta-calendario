
import { useState, useEffect, useMemo } from 'react';
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
  const [allClosures, setAllClosures] = useState<ClosureWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const { includeInvoiced = false } = options;

  const fetchClosures = async () => {
    try {
      setLoading(true);
      
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
        query = query.in('status', ['closed', 'invoiced']);
      } else {
        query = query.eq('status', 'closed');
      }

      const { data: closuresData, error: closuresError } = await query
        .order('created_at', { ascending: false })
        .limit(MAX_CLOSURES_FOR_INVOICES);

      if (closuresError) {
        if (closuresError.message.includes('permission denied') || closuresError.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para ver los cierres. Contacta a un administrador.",
          });
          setAllClosures([]);
          return;
        }
        throw closuresError;
      }

      const formattedClosures: ClosureWithClient[] = (closuresData || []).map(data => ({
        ...formatClosureData(data),
        clientName: (data.clients as any)?.name || ''
      }));
      setAllClosures(formattedClosures);
      
    } catch (error: any) {
      if (!error.message?.includes('permission denied')) {
        toast.error("Error", {
          description: "No se pudieron cargar los cierres disponibles para facturación.",
        });
      }
      setAllClosures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, [includeInvoiced]);

  const [filteredClosures, setFilteredClosures] = useState<ClosureWithClient[]>([]);

  useEffect(() => {
    const filterClosures = async () => {
      if (includeInvoiced) {
        setFilteredClosures(allClosures);
        return;
      }

      try {
        const allClosureIds = allClosures.map(closure => closure.id);

        if (allClosureIds.length === 0) {
          setFilteredClosures([]);
          return;
        }

        const { data: invoicedClosures, error: invoicedError } = await supabase
          .from('invoice_closures')
          .select('closure_id')
          .in('closure_id', allClosureIds);

        if (invoicedError && !invoicedError.message.includes('permission denied')) {
          setFilteredClosures(allClosures);
          return;
        }

        const invoicedClosureIds = new Set(
          invoicedClosures?.map(ic => ic.closure_id) || []
        );

        const availableClosures = allClosures.filter(
          closure => !invoicedClosureIds.has(closure.id)
        );

        setFilteredClosures(availableClosures);
      } catch (error) {
        setFilteredClosures(allClosures);
      }
    };

    if (allClosures.length > 0) {
      filterClosures();
    }
  }, [allClosures, includeInvoiced]);

  return {
    closures: filteredClosures,
    loading,
    refetch: fetchClosures
  };
};
