
import { useState, useEffect } from 'react';
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useServices } from './useServices';
import { useClients } from './useClients';

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { services } = useServices();
  const { clients } = useClients();

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_services(service_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedInvoices: Invoice[] = data.map(invoice => ({
        id: invoice.id,
        folio: invoice.folio,
        serviceIds: invoice.invoice_services?.map((is: any) => is.service_id) || [],
        clientId: invoice.client_id,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        subtotal: Number(invoice.subtotal),
        vat: Number(invoice.vat),
        total: Number(invoice.total),
        status: invoice.status as 'pending' | 'paid' | 'overdue',
        paymentDate: invoice.payment_date,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
      }));

      setInvoices(formattedInvoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las facturas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Generate folio
      const folioNumber = invoices.length + 1;
      const folio = `FACT-${String(folioNumber).padStart(3, '0')}`;

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

      const formattedInvoice: Invoice = {
        id: newInvoice.id,
        folio: newInvoice.folio,
        serviceIds: invoiceData.serviceIds,
        clientId: newInvoice.client_id,
        issueDate: newInvoice.issue_date,
        dueDate: newInvoice.due_date,
        subtotal: Number(newInvoice.subtotal),
        vat: Number(newInvoice.vat),
        total: Number(newInvoice.total),
        status: newInvoice.status as 'pending' | 'paid' | 'overdue',
        paymentDate: newInvoice.payment_date,
        createdAt: newInvoice.created_at,
        updatedAt: newInvoice.updated_at
      };

      setInvoices(prev => [formattedInvoice, ...prev]);

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

      setInvoices(prev => prev.map(invoice => 
        invoice.id === id 
          ? { ...invoice, ...invoiceData, updatedAt: new Date().toISOString() }
          : invoice
      ));

      toast({
        title: "Factura actualizada",
        description: "La factura ha sido actualizada exitosamente.",
      });
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la factura.",
        variant: "destructive",
      });
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInvoices(prev => prev.filter(invoice => invoice.id !== id));
      
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

      setInvoices(prev => prev.map(invoice => 
        invoice.id === id 
          ? { 
              ...invoice, 
              status: 'paid' as const, 
              paymentDate: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString() 
            }
          : invoice
      ));

      toast({
        title: "Factura marcada como pagada",
        description: "El estado de la factura ha sido actualizado.",
      });
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la factura.",
        variant: "destructive",
      });
    }
  };

  const getInvoiceWithDetails = (invoice: Invoice) => {
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
    refetch: fetchInvoices
  };
};
