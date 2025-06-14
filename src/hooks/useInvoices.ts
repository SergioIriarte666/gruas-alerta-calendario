
import { useInvoiceData } from './invoices/useInvoiceData';
import { useInvoiceOperations } from './invoices/useInvoiceOperations';
import { useServices } from './useServices';
import { useClients } from './useClients';

export const useInvoices = () => {
  const { invoices, loading, addInvoice, updateInvoice: updateInvoiceInState, removeInvoice, refetch } = useInvoiceData();
  const { createInvoice: createInvoiceOp, updateInvoice: updateInvoiceOp, deleteInvoice: deleteInvoiceOp, markAsPaid: markAsPaidOp } = useInvoiceOperations();
  const { services } = useServices();
  const { clients } = useClients();

  const createInvoice = async (invoiceData: Parameters<typeof createInvoiceOp>[0]) => {
    const newInvoice = await createInvoiceOp(invoiceData);
    addInvoice(newInvoice);
    return newInvoice;
  };

  const updateInvoice = async (id: string, invoiceData: Parameters<typeof updateInvoiceOp>[1]) => {
    const updates = await updateInvoiceOp(id, invoiceData);
    updateInvoiceInState(id, updates);
  };

  const deleteInvoice = async (id: string) => {
    await deleteInvoiceOp(id);
    removeInvoice(id);
  };

  const markAsPaid = async (id: string) => {
    const updates = await markAsPaidOp(id);
    updateInvoiceInState(id, updates);
  };

  const getInvoiceWithDetails = (invoice: typeof invoices[0]) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const invoiceServices = services.filter(s => invoice.serviceIds.includes(s.id));
    
    return {
      ...invoice,
      client,
      services: invoiceServices
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
