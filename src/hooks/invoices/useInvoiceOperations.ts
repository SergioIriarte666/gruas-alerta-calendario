
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatInvoiceData, generateInvoiceFolio } from '@/utils/invoiceUtils';

export const useInvoiceOperations = () => {
  const { toast } = useToast();

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Generate folio
      const count = await supabase
        .from('invoices')
        .select('id', { count: 'exact' });
      
      const folio = generateInvoiceFolio(count.count || 0);

      // Create invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          folio,
          client_id: invoiceData.clientId,
          issue_date: invoiceData.issueDate,
          due_date: invoiceData.dueDate,
          subtotal: invoiceData.subtotal,
          vat: invoiceData.vat,
          total: invoiceData.total,
          status: invoiceData.status,
          payment_date: invoiceData.paymentDate,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice-service relationships
      if (invoiceData.serviceIds.length > 0) {
        const invoiceServices = invoiceData.serviceIds.map(serviceId => ({
          invoice_id: newInvoice.id,
          service_id: serviceId
        }));

        const { error: relationError } = await supabase
          .from('invoice_services')
          .insert(invoiceServices);

        if (relationError) throw relationError;
      }

      const formattedInvoice: Invoice = formatInvoiceData(newInvoice);
      formattedInvoice.serviceIds = invoiceData.serviceIds;

      toast({
        title: "Factura creada",
        description: `Factura ${folio} creada exitosamente.`,
      });

      return formattedInvoice;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la factura.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateInvoice = async (id: string, invoiceData: Partial<Invoice>) => {
    try {
      const updateData: any = {};
      
      if (invoiceData.clientId !== undefined) updateData.client_id = invoiceData.clientId;
      if (invoiceData.issueDate !== undefined) updateData.issue_date = invoiceData.issueDate;
      if (invoiceData.dueDate !== undefined) updateData.due_date = invoiceData.dueDate;
      if (invoiceData.subtotal !== undefined) updateData.subtotal = invoiceData.subtotal;
      if (invoiceData.vat !== undefined) updateData.vat = invoiceData.vat;
      if (invoiceData.total !== undefined) updateData.total = invoiceData.total;
      if (invoiceData.status !== undefined) updateData.status = invoiceData.status;
      if (invoiceData.paymentDate !== undefined) updateData.payment_date = invoiceData.paymentDate;

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update service relationships if provided
      if (invoiceData.serviceIds !== undefined) {
        // Delete existing relationships
        await supabase
          .from('invoice_services')
          .delete()
          .eq('invoice_id', id);

        // Create new relationships
        if (invoiceData.serviceIds.length > 0) {
          const invoiceServices = invoiceData.serviceIds.map(serviceId => ({
            invoice_id: id,
            service_id: serviceId
          }));

          await supabase
            .from('invoice_services')
            .insert(invoiceServices);
        }
      }

      toast({
        title: "Factura actualizada",
        description: "La factura ha sido actualizada exitosamente.",
      });

      return { ...invoiceData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la factura.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido eliminada exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la factura.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Factura marcada como pagada",
        description: "El estado de la factura ha sido actualizado.",
      });

      return {
        status: 'paid' as const, 
        paymentDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la factura.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid
  };
};
