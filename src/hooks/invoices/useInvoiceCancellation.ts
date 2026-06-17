import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useInvoiceCancellation");
export interface CancellationData {
  invoiceId: string;
  creditNoteNumber: string;
  cancellationReason: string;
  reasonDetails?: string;
}

export interface InvoiceCancellation {
  id: string;
  invoiceId: string;
  creditNoteNumber: string;
  cancellationReason: string;
  reasonDetails?: string;
  cancelledBy?: string;
  cancelledAt: string;
  originalFolio: string;
  originalNumeroFiscal?: string;
  originalTotal: number;
  originalClientId?: string;
  clientName?: string;
  cancelledByName?: string;
}

export const CANCELLATION_REASONS = [
  { value: 'error_datos_cliente', label: 'Error en datos del cliente' },
  { value: 'error_montos', label: 'Error en montos facturados' },
  { value: 'servicio_no_prestado', label: 'Servicio no prestado' },
  { value: 'duplicado', label: 'Duplicado de factura' },
  { value: 'solicitud_cliente', label: 'Solicitud del cliente' },
  { value: 'otro', label: 'Otro (especificar en detalles)' },
];

export const useInvoiceCancellation = () => {
  const queryClient = useQueryClient();

  const cancelInvoice = async (data: CancellationData): Promise<void> => {
    try {
      logger.debug('🚀 Iniciando anulación de factura:', data.invoiceId);

      // 1. Verificar y refrescar sesión si es necesario
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.error('❌ Error obteniendo sesión:', sessionError);
        throw new Error('Error de autenticación. Por favor, recargue la página e intente nuevamente.');
      }
      
      if (!sessionData.session) {
        logger.debug('⚠️ No hay sesión activa, intentando refrescar...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          logger.error('❌ No se pudo refrescar la sesión:', refreshError);
          throw new Error('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
        }
        
        logger.debug('✅ Sesión refrescada exitosamente');
      }

      // 2. Obtener datos de la factura para registro
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, folio, numero_fiscal, total, client_id, status')
        .eq('id', data.invoiceId)
        .maybeSingle();

      if (invoiceError) {
        logger.error('❌ Error consultando factura:', invoiceError);
        throw new Error('Error al acceder a la factura. Verifique su conexión e intente nuevamente.');
      }
      
      if (!invoice) {
        throw new Error('No se pudo acceder a la factura. Recargue la página e intente nuevamente.');
      }

      // Validar que no esté ya anulada
      if (invoice.status === 'cancelled') {
        throw new Error('Esta factura ya está anulada');
      }

      // 2. Verificar que el número de NC no esté duplicado
      const { data: existingNC } = await supabase
        .from('invoice_cancellations')
        .select('id')
        .eq('credit_note_number', data.creditNoteNumber)
        .maybeSingle();

      if (existingNC) {
        throw new Error('Este número de Nota de Crédito ya está registrado');
      }

      // 3. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();

      // 4. Crear registro de anulación
      const { error: cancellationError } = await supabase
        .from('invoice_cancellations')
        .insert({
          invoice_id: data.invoiceId,
          credit_note_number: data.creditNoteNumber,
          cancellation_reason: data.cancellationReason,
          reason_details: data.reasonDetails || null,
          cancelled_by: user?.id || null,
          original_folio: invoice.folio,
          original_numero_fiscal: invoice.numero_fiscal,
          original_total: invoice.total,
          original_client_id: invoice.client_id,
        });

      if (cancellationError) {
        logger.error('❌ Error creando registro de anulación:', cancellationError);
        throw new Error('Error al registrar la anulación');
      }

      logger.debug('✅ Registro de anulación creado');

      // 5. Actualizar estado de la factura a cancelled
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          status: 'cancelled',
          paid_amount: invoice.total,
          updated_at: businessClock.nowISO()
        })
        .eq('id', data.invoiceId);

      if (updateError) {
        throw new Error('Error al actualizar estado de la factura');
      }

      logger.debug('✅ Factura marcada como anulada');

      // 6. Obtener relaciones invoice_closures
      const { data: invoiceClosures, error: closureError } = await supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', data.invoiceId);

      if (closureError) throw closureError;

      const closureIds = invoiceClosures?.map(ic => ic.closure_id) || [];

      if (closureIds.length > 0) {
        // 7. Obtener servicios de los cierres
        const { data: closureServices, error: servicesError } = await supabase
          .from('closure_services')
          .select('service_id')
          .in('closure_id', closureIds);

        if (servicesError) throw servicesError;

        const serviceIds = closureServices?.map(cs => cs.service_id) || [];

        // 8. Revertir estado de servicios de 'invoiced' a 'completed'
        if (serviceIds.length > 0) {
          const { error: revertServicesError } = await supabase
            .from('services')
            .update({ 
              status: 'completed', 
              invoice_folio: null,
              invoice_numero_fiscal: null,
              updated_at: businessClock.nowISO() 
            })
            .in('id', serviceIds)
            .eq('status', 'invoiced');

          if (revertServicesError) {
            logger.error('Error revirtiendo servicios:', revertServicesError);
          } else {
            logger.debug('✅ Servicios revertidos a completed');
          }
        }

        // 9. Revertir estado de cierres de 'invoiced' a 'closed'
        const { error: closureRevertError } = await supabase
          .from('service_closures')
          .update({ status: 'closed', updated_at: businessClock.nowISO() })
          .in('id', closureIds)
          .eq('status', 'invoiced');

        if (closureRevertError) {
          logger.error('Error revirtiendo cierres:', closureRevertError);
        } else {
          logger.debug('✅ Cierres revertidos a closed');
        }

        // 10. Eliminar relación invoice_closures para liberar el cierre para re-facturación
        const { error: deleteRelationError } = await supabase
          .from('invoice_closures')
          .delete()
          .eq('invoice_id', data.invoiceId);

        if (deleteRelationError) {
          logger.error('Error eliminando relación invoice_closures:', deleteRelationError);
        } else {
          logger.debug('✅ Relación invoice_closures eliminada - Cierre disponible para re-facturar');
        }
      }

      // 10b. También revertir servicios vinculados directamente via invoice_services
      const { data: directServices } = await supabase
        .from('invoice_services')
        .select('service_id')
        .eq('invoice_id', data.invoiceId);

      if (directServices && directServices.length > 0) {
        const directServiceIds = directServices.map(ds => ds.service_id);
        await supabase
          .from('services')
          .update({ 
            status: 'completed', 
            invoice_folio: null,
            invoice_numero_fiscal: null,
            updated_at: businessClock.nowISO() 
          })
          .in('id', directServiceIds)
          .eq('status', 'invoiced');

        await supabase
          .from('invoice_services')
          .delete()
          .eq('invoice_id', data.invoiceId);
        
        logger.debug('✅ Servicios directos revertidos y relaciones eliminadas');
      }

      // 11. Invalidar queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] }),
        queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['invoice-cancellations'] }),
        queryClient.invalidateQueries({ queryKey: ['enhanced-service-details'] }),
        queryClient.invalidateQueries({ queryKey: ['serviceDetails'] })
      ]);

      toast.success("Factura anulada correctamente", {
        description: `NC ${data.creditNoteNumber} registrada. Los servicios están disponibles para nueva facturación.`,
      });

    } catch (error: any) {
      logger.error('❌ Error en anulación:', error);
      toast.error("No se pudo anular la factura", {
        description: error.message || "Ocurrió un error inesperado. Por favor, intenta nuevamente.",
      });
      throw error;
    }
  };

  const fetchCancellations = async (): Promise<InvoiceCancellation[]> => {
    const { data, error } = await supabase
      .from('invoice_cancellations')
      .select(`
        id,
        invoice_id,
        credit_note_number,
        cancellation_reason,
        reason_details,
        cancelled_by,
        cancelled_at,
        original_folio,
        original_numero_fiscal,
        original_total,
        original_client_id,
        clients:original_client_id (name),
        profiles:cancelled_by (full_name)
      `)
      .order('cancelled_at', { ascending: false });

    if (error) {
      logger.error('Error fetching cancellations:', error);
      throw error;
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      invoiceId: item.invoice_id,
      creditNoteNumber: item.credit_note_number,
      cancellationReason: item.cancellation_reason,
      reasonDetails: item.reason_details,
      cancelledBy: item.cancelled_by,
      cancelledAt: item.cancelled_at,
      originalFolio: item.original_folio,
      originalNumeroFiscal: item.original_numero_fiscal,
      originalTotal: item.original_total,
      originalClientId: item.original_client_id,
      clientName: item.clients?.name || 'Cliente no encontrado',
      cancelledByName: item.profiles?.full_name || 'Usuario desconocido',
    }));
  };

  return {
    cancelInvoice,
    fetchCancellations,
  };
};
