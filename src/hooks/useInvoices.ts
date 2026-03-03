
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { useInvoiceData } from './invoices/useInvoiceData';
import { useInvoiceOperations } from './invoices/useInvoiceOperations';

export const useInvoices = () => {
  const { invoices, loading, addInvoice, updateInvoice: updateInvoiceData, removeInvoice, refetch } = useInvoiceData();
  const { createInvoice: createInvoiceOp, updateInvoice: updateInvoiceOp, deleteInvoice: deleteInvoiceOp, markAsPaid } = useInvoiceOperations();
  const [closuresMap, setClosuresMap] = useState<Record<string, any>>({});
  const [clientsMap, setClientsMap] = useState<Record<string, any>>({});

  // Fetch only related closures/clients for currently loaded invoices
  useEffect(() => {
    const fetchRelatedData = async () => {
      if (!invoices.length) return;

      try {
        const closureIds = Array.from(
          new Set(invoices.map(inv => inv.closureId).filter((id): id is string => Boolean(id)))
        );
        const clientIds = Array.from(
          new Set(invoices.map(inv => inv.clientId).filter((id): id is string => Boolean(id)))
        );

        // Optimization: Don't refetch if we already have the data
        // This is a simple check, could be more robust
        const missingClosureIds = closureIds.filter(id => !closuresMap[id]);
        const missingClientIds = clientIds.filter(id => !clientsMap[id]);

        if (missingClosureIds.length === 0 && missingClientIds.length === 0) {
          return;
        }

        const [closuresData, clientsData] = await Promise.all([
          missingClosureIds.length > 0
            ? supabase.from('service_closures').select('id, folio, date_from, date_to, total, status, client_id').in('id', missingClosureIds)
            : Promise.resolve({ data: [], error: null }),
          missingClientIds.length > 0
            ? supabase.from('clients').select('id, name, rut, email, phone').in('id', missingClientIds)
            : Promise.resolve({ data: [], error: null })
        ]);

        if (closuresData.error) throw closuresData.error;
        if (clientsData.error) throw clientsData.error;

        if (closuresData.data?.length) {
          setClosuresMap(prev => {
            const newMap = { ...prev };
            closuresData.data.forEach(c => newMap[c.id] = c);
            return newMap;
          });
        }

        if (clientsData.data?.length) {
          setClientsMap(prev => {
            const newMap = { ...prev };
            clientsData.data.forEach(c => newMap[c.id] = c);
            return newMap;
          });
        }
      } catch (error) {
        console.error('Error fetching related data:', error);
        // Silent error to avoid toast spam
      }
    };

    fetchRelatedData();
  }, [invoices]); // We still depend on invoices, but we check for missing IDs inside

  // ... (createInvoice, updateInvoice, deleteInvoice implementation)
  const createInvoice = async (data: any) => {
    try {
      const newInvoice = await createInvoiceOp(data);
      addInvoice(newInvoice);
      // No redundant refetch — React Query invalidation in useInvoiceOperations handles it
      return newInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  };

  const updateInvoice = async (id: string, data: any) => {
    try {
      const updatedInvoice = await updateInvoiceOp(id, data);
      updateInvoiceData(id, updatedInvoice);
      return updatedInvoice;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      await deleteInvoiceOp(id);
      removeInvoice(id);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  };

  const getInvoiceWithDetails = (invoice: Invoice) => {
    return {
      ...invoice,
      closure: invoice.closureId ? closuresMap[invoice.closureId] : undefined,
      client: invoice.clientId ? clientsMap[invoice.clientId] : undefined
    };
  };

  return {
    invoices,
    loading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid: async (id: string, paymentDate?: string) => {
      try {
        const result = await markAsPaid(id, paymentDate);
        // Refrescar datos después del pago
        refetch();
        return result;
      } catch (error) {
        throw error;
      }
    },
    getInvoiceWithDetails,
    refetch
  };
};
