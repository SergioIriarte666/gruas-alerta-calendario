
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData, generateInvoiceFolio } from '@/utils/invoiceUtils';

export const useInvoiceOperations = () => {

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Generate folio
      const { count, error: countError } = await supabase
        .from('invoices')
        .select('id', { count: 'exact' });

      if (countError) throw countError;
      
      const folio = generateInvoiceFolio(count || 0);

      // Ensure integer values
      const subtotal = Math.round(invoiceData.subtotal);
      const vat = Math.round(invoiceData.vat);
      const total = Math.round(invoiceData.total);

      // Create invoice
      const { data, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          folio,
          client_id: invoiceData.clientId,
          issue_date: invoiceData.issueDate,
          due_date: invoiceData.dueDate,
          subtotal,
          vat,
          total,
          status: invoiceData.status,
          payment_date: invoiceData.paymentDate,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice-closure relationship with improved error handling
      const { error: relationError } = await supabase
        .from('invoice_closures')
        .insert({
          invoice_id: data.id,
          closure_id: invoiceData.closureId
        });

      if (relationError) {
        // Check for specific validation errors
        if (relationError.message.includes('mismo cliente')) {
          toast.error("Error de validación", {
            description: "La factura y el cierre deben pertenecer al mismo cliente.",
          });
        } else if (relationError.message.includes('cerrados')) {
          toast.error("Estado del cierre inválido", {
            description: "Solo se pueden facturar cierres que estén cerrados.",
          });
        } else if (relationError.message.includes('ya ha sido facturado')) {
          toast.error("Cierre ya facturado", {
            description: "Este cierre ya ha sido facturado anteriormente.",
          });
        } else if (relationError.message.includes('permission denied') || relationError.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para crear esta relación. Contacta a un administrador.",
          });
        } else {
          toast.error("Error al vincular cierre", {
            description: relationError.message || "Error desconocido al vincular el cierre con la factura.",
          });
        }
        
        // Delete the created invoice if the relationship failed
        await supabase.from('invoices').delete().eq('id', data.id);
        throw relationError;
      }
      
      const newInvoice = formatInvoiceData({ ...data, invoice_closures: [{ closure_id: invoiceData.closureId }] });

      toast.success("Factura creada", {
        description: `Factura ${folio} creada exitosamente.`,
      });

      return newInvoice;
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      
      // Don't show toast again if we already handled it above
      if (!error.message?.includes('mismo cliente') && 
          !error.message?.includes('cerrados') && 
          !error.message?.includes('ya ha sido facturado') &&
          !error.message?.includes('permission denied')) {
        toast.error("Error al crear factura", {
          description: error.message || "No se pudo crear la factura.",
        });
      }
      throw error;
    }
  };

  const updateInvoice = async (id: string, invoiceData: Partial<Invoice>) => {
    try {
      const updateData: any = {};
      
      if (invoiceData.clientId !== undefined) updateData.client_id = invoiceData.clientId;
      if (invoiceData.issueDate !== undefined) updateData.issue_date = invoiceData.issueDate;
      if (invoiceData.dueDate !== undefined) updateData.due_date = invoiceData.dueDate;
      if (invoiceData.subtotal !== undefined) updateData.subtotal = Math.round(invoiceData.subtotal);
      if (invoiceData.vat !== undefined) updateData.vat = Math.round(invoiceData.vat);
      if (invoiceData.total !== undefined) updateData.total = Math.round(invoiceData.total);
      if (invoiceData.status !== undefined) updateData.status = invoiceData.status;
      if (invoiceData.paymentDate !== undefined) updateData.payment_date = invoiceData.paymentDate;

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

      if (error) {
        if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para actualizar esta factura. Contacta a un administrador.",
          });
        }
        throw error;
      }

      // Update closure relationship if closureId changed
      if (invoiceData.closureId !== undefined) {
        const { error: relationError } = await supabase
          .from('invoice_closures')
          .update({ closure_id: invoiceData.closureId })
          .eq('invoice_id', id);

        if (relationError) {
          // Handle relation update errors
          if (relationError.message.includes('mismo cliente')) {
            toast.error("Error de validación", {
              description: "La factura y el cierre deben pertenecer al mismo cliente.",
            });
          } else if (relationError.message.includes('permission denied')) {
            toast.error("Permisos insuficientes", {
              description: "No tienes permisos para actualizar esta relación.",
            });
          }
          throw relationError;
        }
      }

      toast.success("Factura actualizada", {
        description: "La factura ha sido actualizada exitosamente.",
      });

      return { ...invoiceData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      
      if (!error.message?.includes('permission denied') && 
          !error.message?.includes('mismo cliente')) {
        toast.error("Error al actualizar factura", {
          description: error.message || "No se pudo actualizar la factura.",
        });
      }
      throw error;
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para eliminar esta factura. Contacta a un administrador.",
          });
        }
        throw error;
      }
      
      toast.success("Factura eliminada", {
        description: "La factura ha sido eliminada exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      
      if (!error.message?.includes('permission denied')) {
        toast.error("Error al eliminar factura", {
          description: error.message || "No se pudo eliminar la factura.",
        });
      }
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

      if (error) {
        if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
          toast.error("Permisos insuficientes", {
            description: "No tienes permisos para actualizar esta factura. Contacta a un administrador.",
          });
        }
        throw error;
      }

      toast.success("Factura pagada", {
        description: "La factura ha sido marcada como pagada exitosamente.",
      });

      return { status: 'paid' as const, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
      
      if (!error.message?.includes('permission denied')) {
        toast.error("Error al marcar como pagada", {
          description: error.message || "No se pudo marcar la factura como pagada.",
        });
      }
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
