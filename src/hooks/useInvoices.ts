
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

  // Fetch related data
  useEffect(() => {
    const fetchRelatedData = async () => {
      try {
        const [closuresData, clientsData] = await Promise.all([
          supabase.from('service_closures').select('*').throwOnError(),
          supabase.from('clients').select('*').throwOnError()
        ]);

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
  }, []);

  const createInvoice = async (data: any) => {
    try {
      const newInvoice = await createInvoiceOp(data);
      addInvoice(newInvoice);
      
      // Force refresh of services to show updated status
      window.dispatchEvent(new CustomEvent('invoice-created'));
      
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
      
      // Force refresh of services to show updated status
      window.dispatchEvent(new CustomEvent('invoice-deleted'));
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
    markAsPaid,
    getInvoiceWithDetails,
    refetch
  };
};
