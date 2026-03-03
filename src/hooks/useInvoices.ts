
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { useInvoiceData } from './invoices/useInvoiceData';
import { useInvoiceOperations } from './invoices/useInvoiceOperations';

export const useInvoices = () => {
  const { invoices, loading, addInvoice, updateInvoice: updateInvoiceData, removeInvoice, refetch } = useInvoiceData();
  const { createInvoice: createInvoiceOp, updateInvoice: updateInvoiceOp, deleteInvoice: deleteInvoiceOp, markAsPaid } = useInvoiceOperations();
  const [closures, setClosures] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Fetch only related closures/clients for currently loaded invoices
  useEffect(() => {
    const fetchRelatedData = async () => {
      try {
        const closureIds = Array.from(
          new Set(invoices.map(inv => inv.closureId).filter((id): id is string => Boolean(id)))
        );
        const clientIds = Array.from(
          new Set(invoices.map(inv => inv.clientId).filter((id): id is string => Boolean(id)))
        );

        const emptyResult = { data: [] as any[], error: null as any };

        const [closuresData, clientsData] = await Promise.all([
          closureIds.length > 0
            ? supabase.from('service_closures').select('id, folio, date_from, date_to, total, status, client_id').in('id', closureIds)
            : Promise.resolve(emptyResult),
          clientIds.length > 0
            ? supabase.from('clients').select('id, name, rut, email, phone').in('id', clientIds)
            : Promise.resolve(emptyResult)
        ]);

        if (closuresData.error) throw closuresData.error;
        if (clientsData.error) throw clientsData.error;

        setClosures(closuresData.data || []);
        setClients(clientsData.data || []);
      } catch (error) {
        console.error('Error fetching related data:', error);
        toast.error("Error", {
          description: "No se pudieron cargar los datos relacionados.",
        });
      }
    };

    fetchRelatedData();
  }, [invoices]);

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
    const closure = closures.find(c => 
      invoice.closureId === c.id
    );
    
    const client = clients.find(c => c.id === invoice.clientId);
    
    return {
      ...invoice,
      closure,
      client
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
