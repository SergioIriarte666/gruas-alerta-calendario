
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData, generateInvoiceFolio } from '@/utils/invoiceUtils';

export const useInvoiceOperations = () => {

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Generate folio
      const count = await supabase
        .from('invoices')
        .select('id', { count: 'exact' });
      
      const folio = generateInvoiceFolio(count.count || 0);

      // Create invoice
      const { data, error: invoiceError } = await supabase
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

      // Create invoice-closure relationship
      const { error: relationError } = await supabase
        .from('invoice_closures')
        .insert({
          invoice_id: data.id,
          closure_id: invoiceData.closureId
        });

      if (relationError) throw relationError;
      
      const newInvoice = formatInvoiceData({ ...data, invoice_closures: [{ closure_id: invoiceData.closureId }] });

      toast.success("Factura creada", {
        description: `Factura ${folio} creada exitosamente.`,
      });

      return newInvoice;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error("Error", {
        description: "No se pudo crear la factura.",
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

      // Update closure relationship if closureId changed
      if (invoiceData.closureId !== undefined) {
        const { error: relationError } = await supabase
          .from('invoice_closures')
          .update({ closure_id: invoiceData.closureId })
          .eq('invoice_id', id);

        if (relationError) throw relationError;
      }

      toast.success("Factura actualizada", {
        description: "La factura ha sido actualizada exitosamente.",
      });

      return { ...invoiceData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast.error("Error", {
        description: "No se pudo actualizar la factura.",
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
      
      toast.success("Factura eliminada", {
        description: "La factura ha sido eliminada exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast.error("Error", {
        description: "No se pudo eliminar la factura.",
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

      toast.success("Factura pagada", {
        description: "La factura ha sido marcada como pagada exitosamente.",
      });

      return { status: 'paid' as const, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
      toast.error("Error", {
        description: "No se pudo marcar la factura como pagada.",
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
