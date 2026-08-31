import { businessClock } from '@/utils/businessClock';

import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData } from '@/utils/invoiceUtils';
import { useQueryClient } from '@tanstack/react-query';
import {
  assertAutomaticPaymentSucceeded,
  normalizeInvoiceStatusBeforeAutomaticPayment,
} from '@/utils/invoicePaymentCreation';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useInvoiceOperations");

export interface UpdateInvoiceOptions {
  /** The caller owns the aggregate feedback (for example, a batch operation). */
  silent?: boolean;
  /** Prevent status mutations on invoices created by the operational system. */
  protectSystemStatus?: boolean;
}

export interface CreateInvoiceOptions {
  /** The caller owns aggregate progress and feedback, such as a batch importer. */
  silent?: boolean;
  /** Defer broad query invalidation until the complete batch finishes. */
  skipInvalidation?: boolean;
}

const INVOICE_SELECT = `
  id,
  client_id,
  folio,
  issue_date,
  due_date,
  subtotal,
  vat,
  total,
  status,
  payment_date,
  numero_fiscal,
  payment_term_id,
  paid_amount,
  remaining_amount,
  notes,
  product_service_description,
  created_at,
  updated_at,
  created_by
`;

export const useInvoiceOperations = () => {
  const queryClient = useQueryClient();

  const createInvoice = async (
    invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>,
    options: CreateInvoiceOptions = {},
  ): Promise<Invoice> => {
    try {
      if (!invoiceData.closureId) {
        throw new Error('closureId es requerido para crear una factura');
      }

      // Obtener servicios del cierre
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select(`
          service_id,
          services (
            id, folio, value, client_covered_amount, has_excess
          )
        `)
        .eq('closure_id', invoiceData.closureId);

      if (closureError) {
        logger.error('❌ Error al obtener servicios del cierre:', closureError);
        throw new Error('Error al obtener servicios del cierre');
      }

      if (!closureServices || closureServices.length === 0) {
        throw new Error('No se encontraron servicios en el cierre especificado');
      }

      const serviceIds = closureServices.map(cs => cs.service_id);

      const trimmedDescription = (invoiceData.productServiceDescription || '').trim();
      if (trimmedDescription.length > 500) {
        throw new Error('La descripción de producto o servicio debe tener máximo 500 caracteres');
      }

      const requestedStatus = invoiceData.status || 'draft';

      // Una factura solicitada como pagada se inserta primero como emitida. El
      // pago automático posterior es quien establece paid + paid_amount.
      const invoiceDataForTransaction = {
        client_id: invoiceData.clientId,
        issue_date: invoiceData.issueDate,
        due_date: invoiceData.dueDate,
        subtotal: invoiceData.subtotal.toString(),
        vat: invoiceData.vat.toString(),
        total: invoiceData.total.toString(),
        numero_fiscal: invoiceData.numeroFiscal,
        status: normalizeInvoiceStatusBeforeAutomaticPayment(requestedStatus),
        payment_term_id: invoiceData.paymentTermId || '',
        notes: invoiceData.notes || null,
        product_service_description: trimmedDescription
      };

      // Usar función transaccional que maneja folio correctamente
      const { data: transactionResult, error: transactionError } = await supabase
        .rpc('create_invoice_transaction', {
          p_invoice_data: invoiceDataForTransaction,
          p_service_ids: serviceIds
        });

      if (transactionError) {
        logger.error('❌ Error en transacción de factura:', transactionError);
        throw new Error(`Error al crear la factura: ${transactionError.message}`);
      }

      // La función SQL devuelve TABLE(invoice_id UUID, invoice_folio TEXT)
      if (!transactionResult || !Array.isArray(transactionResult) || transactionResult.length === 0) {
        throw new Error('Error en la transacción de factura: no se recibió respuesta válida');
      }

      const result = transactionResult[0];
      if (!result?.invoice_id || !result?.invoice_folio) {
        throw new Error('Error en la transacción de factura: datos incompletos');
      }

      // Obtener la factura creada
      const { data: newInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('id', result.invoice_id)
        .single();

      if (fetchError || !newInvoice) {
        throw new Error('Error al obtener la factura creada');
      }

      // Crear relación invoice_closures
      const { error: closureRelationError } = await supabase
        .from('invoice_closures')
        .insert({
          invoice_id: newInvoice.id,
          closure_id: invoiceData.closureId
        });

      if (closureRelationError) {
        logger.error('❌ Error al crear relación invoice_closures:', closureRelationError);
        throw new Error('Error al relacionar factura con cierre');
      }

      // Actualizar estado del cierre a 'invoiced' vía RPC SECURITY DEFINER.
      // El UPDATE directo anterior quedaba sujeto a RLS y fallaba silenciosamente
      // (~22% de los casos en producción), dejando cierres en 'closed' pese a
      // estar facturados. Esta función bypassa RLS de forma consistente.
      const { error: closureUpdateError } = await supabase
        .rpc('update_closure_status_on_invoice', { p_closure_id: invoiceData.closureId });

      if (closureUpdateError) {
        logger.error('❌ Error al actualizar estado del cierre:', closureUpdateError);
        toast.error("Error crítico", {
          description: `La factura ${result.invoice_folio} se creó, pero el cierre no pudo marcarse como facturado. Revisar manualmente el cierre ${invoiceData.closureId}.`,
          duration: Infinity,
        });
      }

      // Actualizar servicios a estado 'invoiced' con folio y número fiscal
      try {
        const updatePromises = serviceIds.map(async (serviceId) => {
          const { error } = await supabase
            .rpc('force_update_service_to_invoiced', {
              p_service_id: serviceId,
              p_invoice_folio: result.invoice_folio,
              p_numero_fiscal: invoiceData.numeroFiscal || null
            });
          if (error) {
            logger.error(`❌ Error actualizando servicio ${serviceId}:`, error);
          }
          return { serviceId, error };
        });
        const results = await Promise.all(updatePromises);
        const failed = results.filter(r => r.error);
        if (failed.length > 0) {
          logger.warn(`⚠️ ${failed.length} servicios no se pudieron actualizar a invoiced`);
        }
      } catch (servicesError) {
        logger.error('❌ Error actualizando servicios a invoiced:', servicesError);
        toast.warning("Advertencia", {
          description: "La factura se creó, pero algunos servicios pueden no haberse actualizado correctamente.",
        });
      }

      // Invalidar queries de facturación + servicios enhanced para sincronizar modals
      if (!options.skipInvalidation) {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['closures'] });
        queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] });
        // Invalidar enhanced-service-details para que modals reflejen factura recién creada
        serviceIds.forEach(sid => {
          queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', sid] });
        });
        queryClient.invalidateQueries({ queryKey: ['serviceDetails'] });
      }

      // Dispatch del evento custom para otros listeners
      window.dispatchEvent(new CustomEvent('invoice-created', { 
        detail: { invoiceId: newInvoice.id, serviceIds } 
      }));
      
      if (!options.silent) {
        toast.success("Factura creada", {
          description: `Factura ${result.invoice_folio} creada exitosamente.`,
        });
      }

      return formatInvoiceData({ ...newInvoice, invoice_closures: [{ closure_id: invoiceData.closureId }] });

    } catch (error: any) {
      logger.error('❌ Error general en createInvoice:', error);
      if (!options.silent) {
        toast.error("Error al crear factura", {
          description: error.message || "No se pudo crear la factura.",
        });
      }
      throw error;
    }
  };

  const updateInvoice = async (
    id: string,
    invoiceData: Partial<Invoice>,
    options: UpdateInvoiceOptions = {}
  ) => {
    // Validate input parameters first
    if (!id || !invoiceData || Object.keys(invoiceData).length === 0) {
      throw new Error('ID de factura y datos de actualización son requeridos');
    }

    // Start transaction-like operations with error rollback capability
    let originalState: any = null;
    
    try {
      // Step 1: Get current state for validation and rollback purposes
      const { data: currentInvoice, error: getCurrentError } = await supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('id', id)
        .single();

      if (getCurrentError) {
        throw new Error(`Error obteniendo factura actual: ${getCurrentError.message}`);
      }

      if (!currentInvoice) {
        throw new Error('Factura no encontrada');
      }

      originalState = { ...currentInvoice };

      const invoiceSource = (currentInvoice as Record<string, unknown>).source;
      const isHistoricalInvoice =
        invoiceSource === 'historico' || currentInvoice.folio?.startsWith('HIST-');
      if (
        options.protectSystemStatus &&
        invoiceData.status !== undefined &&
        !isHistoricalInvoice
      ) {
        const protectedError = new Error(
          'Las facturas del sistema no pueden cambiar de estado desde el módulo Históricos.'
        );
        (protectedError as any).code = 'PROTECTED_INVOICE_STATUS';
        throw protectedError;
      }

      const { data: currentClosure, error: getCurrentClosureError } = await supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', id)
        .maybeSingle();

      if (getCurrentClosureError) {
        throw new Error(`Error obteniendo cierre actual: ${getCurrentClosureError.message}`);
      }

      // Step 2: Pre-validate critical constraints
      if (invoiceData.numeroFiscal && invoiceData.numeroFiscal !== currentInvoice.numero_fiscal) {
        const { data: existingFiscal } = await supabase
          .from('invoices')
          .select('id')
          .eq('numero_fiscal', invoiceData.numeroFiscal)
          .neq('id', id)
          .maybeSingle();

        if (existingFiscal) {
          throw new Error('Este número fiscal ya está en uso por otra factura');
        }
      }

      // Validate date logic
      if (invoiceData.issueDate && invoiceData.dueDate) {
        const issueDate = new Date(invoiceData.issueDate);
        const dueDate = new Date(invoiceData.dueDate);
        if (dueDate <= issueDate) {
          throw new Error('La fecha de vencimiento debe ser posterior a la fecha de emisión');
        }
      }

      // Step 3: Prepare update data with strict validation
      const updateData: any = {};
      
      if (invoiceData.issueDate !== undefined) {
        if (!invoiceData.issueDate) throw new Error('Fecha de emisión no puede estar vacía');
        updateData.issue_date = invoiceData.issueDate;
      }
      if (invoiceData.dueDate !== undefined) {
        if (!invoiceData.dueDate) throw new Error('Fecha de vencimiento no puede estar vacía');
        updateData.due_date = invoiceData.dueDate;
      }
      if (invoiceData.status !== undefined) {
        const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
        if (!validStatuses.includes(invoiceData.status)) {
          throw new Error(`Estado inválido: ${invoiceData.status}`);
        }
        updateData.status = invoiceData.status;
      }
      if (invoiceData.numeroFiscal !== undefined) {
        updateData.numero_fiscal = invoiceData.numeroFiscal || null;
      }
      if (invoiceData.paymentDate !== undefined) {
        // Convertir cadena vacía a null para evitar error de PostgreSQL
        updateData.payment_date = invoiceData.paymentDate === '' ? null : invoiceData.paymentDate;
      }
      if (invoiceData.paymentTermId !== undefined) {
        // Convertir undefined o valores falsy a null
        updateData.payment_term_id = invoiceData.paymentTermId ? invoiceData.paymentTermId : null;
      }
      if (invoiceData.notes !== undefined) {
        updateData.notes = invoiceData.notes;
      }
      if (invoiceData.productServiceDescription !== undefined) {
        const trimmed = invoiceData.productServiceDescription.trim();
        if (trimmed.length > 500) {
          throw new Error('La descripción de producto o servicio debe tener máximo 500 caracteres');
        }
        updateData.product_service_description = trimmed;
      }
      
      // Handle calculated fields with validation
      if (invoiceData.subtotal !== undefined) {
        if (invoiceData.subtotal < 0) throw new Error('Subtotal no puede ser negativo');
        updateData.subtotal = Math.round(invoiceData.subtotal);
      }
      if (invoiceData.vat !== undefined) {
        if (invoiceData.vat < 0) throw new Error('IVA no puede ser negativo');
        updateData.vat = Math.round(invoiceData.vat);
      }
      if (invoiceData.total !== undefined) {
        if (invoiceData.total < 0) throw new Error('Total no puede ser negativo');
        updateData.total = Math.round(invoiceData.total);
      }
      if (invoiceData.clientId !== undefined) {
        if (!invoiceData.clientId) throw new Error('ID de cliente es requerido');
        updateData.client_id = invoiceData.clientId;
      }

      // Step 4: Execute main invoice update
      const { data: updateResult, error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select('id, folio, numero_fiscal, status')
        .single();

      if (updateError) {
        if (updateError.message.includes('permission denied')) {
          throw new Error('Permisos insuficientes para actualizar esta factura');
        } else if (updateError.message.includes('invoices_numero_fiscal_unique')) {
          throw new Error('Este número fiscal ya está en uso por otra factura');
        } else {
          throw new Error(`Error actualizando factura: ${updateError.message}`);
        }
      }

      if (invoiceData.status !== undefined && updateResult.status !== invoiceData.status) {
        throw new Error(
          `El estado no fue persistido. Se solicitó "${invoiceData.status}" y la base devolvió "${updateResult.status}".`
        );
      }

      let finalClosureId = currentClosure?.closure_id;

      // Step 5: Handle closure relationship changes with atomic operations
      if (invoiceData.closureId !== undefined && invoiceData.closureId !== currentClosure?.closure_id) {
        try {
          if (currentClosure?.closure_id) {
            // Get old closure services for cleanup
            const { data: oldClosureServices, error: oldServicesError } = await supabase
              .from('closure_services')
              .select('service_id')
              .eq('closure_id', currentClosure.closure_id);

            if (oldServicesError) {
              throw new Error(`Error obteniendo servicios del cierre anterior: ${oldServicesError.message}`);
            }

            // Clear old services in batch
            if (oldClosureServices && oldClosureServices.length > 0) {
              const oldServiceIds = oldClosureServices.map(cs => cs.service_id);
              
              for (const serviceId of oldServiceIds) {
                const { error: clearError } = await supabase
                  .rpc('force_update_service_to_invoiced', {
                    p_service_id: serviceId,
                    p_invoice_folio: null,
                    p_numero_fiscal: null
                  });

                if (clearError) {
                  throw new Error(`Error limpiando servicio ${serviceId}: ${clearError.message}`);
                }
              }
            }
          }

          // Update closure relationship
          // First check if relationship exists
          const { data: existingRelation } = await supabase
            .from('invoice_closures')
            .select('id')
            .eq('invoice_id', id)
            .maybeSingle();

          if (existingRelation) {
            const { error: relationError } = await supabase
              .from('invoice_closures')
              .update({ closure_id: invoiceData.closureId })
              .eq('invoice_id', id);

            if (relationError) {
              throw new Error(`Error actualizando relación de cierre: ${relationError.message}`);
            }
          } else {
            // Create new relationship if it didn't exist
            const { error: relationError } = await supabase
              .from('invoice_closures')
              .insert({ 
                invoice_id: id,
                closure_id: invoiceData.closureId 
              });

            if (relationError) {
              throw new Error(`Error creando relación de cierre: ${relationError.message}`);
            }
          }

          finalClosureId = invoiceData.closureId;
        } catch (closureError) {
          // Rollback main invoice update on closure change failure
          await supabase
            .from('invoices')
            .update({
              issue_date: originalState.issue_date,
              due_date: originalState.due_date,
              status: originalState.status,
              numero_fiscal: originalState.numero_fiscal,
              payment_date: originalState.payment_date,
              subtotal: originalState.subtotal,
              vat: originalState.vat,
              total: originalState.total,
              client_id: originalState.client_id
            })
            .eq('id', id);
          
          throw closureError;
        }
      }

      // Step 6: Update related services with proper error handling
      try {
        const { data: closureServices, error: getServicesError } = await supabase
          .from('closure_services')
          .select('service_id')
          .eq('closure_id', finalClosureId);

        if (getServicesError) {
          throw new Error(`Error obteniendo servicios del cierre: ${getServicesError.message}`);
        }

        if (closureServices && closureServices.length > 0) {
          const serviceIds = closureServices.map(cs => cs.service_id);
          const finalNumeroFiscal = invoiceData.numeroFiscal !== undefined ? 
            (invoiceData.numeroFiscal || null) : 
            updateResult.numero_fiscal;

          // Update services in batch with detailed error tracking
          const updatePromises = serviceIds.map(async (serviceId) => {
            const { data: result, error } = await supabase
              .rpc('force_update_service_to_invoiced', {
                p_service_id: serviceId,
                p_invoice_folio: updateResult.folio,
                p_numero_fiscal: finalNumeroFiscal
              });

            if (error) {
              throw new Error(`Error actualizando servicio ${serviceId}: ${error.message}`);
            }
            return { serviceId, result };
          });

          const _results = await Promise.all(updatePromises);
        }
      } catch (servicesError) {
        logger.error('Error updating services, but invoice update succeeded:', servicesError);
        // Don't rollback invoice here, just log the service update error
        if (!options.silent) {
          toast.error("Advertencia", {
            description: "Factura actualizada pero algunos servicios pueden necesitar sincronización manual.",
          });
        }
      }

      // Invalidar queries de facturación + enhanced details para sincronizar modals
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['closures'] });
      queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details'] });
      queryClient.invalidateQueries({ queryKey: ['serviceDetails'] });

      if (!options.silent) {
        toast.success("Factura actualizada", {
          description: "La factura ha sido actualizada exitosamente.",
        });
      }

      return { ...invoiceData, updatedAt: businessClock.nowISO() };
    } catch (error: any) {
      logger.error('❌ Invoice update transaction failed:', error);
      
      // Show specific error messages
      if (!options.silent) {
        toast.error("Error al actualizar factura", {
          description: error.message || "No se pudo actualizar la factura.",
        });
      }
      
      throw error;
    }
  };

  const deleteInvoice = async (id: string, options: { force?: boolean } = {}) => {
    try {
      // Guard: verificar si es factura protegida (no histórica)
      const { data: invoiceCheck, error: checkError } = await supabase
        .from('invoices')
        .select('folio')
        .eq('id', id)
        .single();

      if (checkError) throw checkError;

      const isHistorical = invoiceCheck?.folio?.startsWith('HIST-');
      if (!isHistorical && !options.force) {
        const error = new Error('Esta factura está protegida porque fue creada en la aplicación. Para eliminarla, usa la opción de eliminación con confirmación reforzada.');
        (error as any).code = 'PROTECTED_INVOICE';
        (error as any).folio = invoiceCheck?.folio;
        throw error;
      }

      const invoiceFolio = invoiceCheck?.folio || '';
      const { data: invoicePaymentApplications, error: paymentAppsError } = await supabase
        .from('payment_applications')
        .select('payment_id')
        .eq('invoice_id', id);

      if (paymentAppsError) throw paymentAppsError;

      const paymentIds = Array.from(new Set((invoicePaymentApplications || []).map((row: any) => row.payment_id).filter(Boolean)));

      if (paymentIds.length > 0) {
        const { error: deleteAppsError } = await supabase
          .from('payment_applications')
          .delete()
          .eq('invoice_id', id);

        if (deleteAppsError) throw deleteAppsError;

        if (invoiceFolio) {
          const { data: autoPayments } = await supabase
            .from('payments')
            .select('id')
            .in('id', paymentIds)
            .eq('bank_reference', `AUTO-${invoiceFolio}`)
            .ilike('notes', '%Pago automático%');

          const autoPaymentIds = (autoPayments || []).map((p: any) => p.id).filter(Boolean);
          if (autoPaymentIds.length > 0) {
            await supabase
              .from('payments')
              .delete()
              .in('id', autoPaymentIds);
          }
        }
      }

      // 1. Obtener relaciones invoice_closures
      const { data: invoiceClosures, error: closureError } = await supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', id);

      if (closureError) throw closureError;

      // 2. Obtener servicios de los cierres para revertir su estado
      const closureIds = invoiceClosures?.map(ic => ic.closure_id) || [];
      
      if (closureIds.length > 0) {
        const { data: closureServices, error: servicesError } = await supabase
          .from('closure_services')
          .select('service_id')
          .in('closure_id', closureIds);

        if (servicesError) throw servicesError;

        const serviceIds = closureServices?.map(cs => cs.service_id) || [];

        // 3. PRIMERO revertir estado de servicios de 'invoiced' a 'completed' y limpiar folio/fiscal
        if (serviceIds.length > 0) {
          const { data: servicesToRevert, error: checkError } = await supabase
            .from('services')
            .select('id, folio, status')
            .in('id', serviceIds)
            .eq('status', 'invoiced');

          if (checkError) throw checkError;

          if (servicesToRevert && servicesToRevert.length > 0) {
            const { error: revertError } = await supabase
              .from('services')
              .update({ 
                status: 'completed', 
                invoice_folio: null,
                invoice_numero_fiscal: null,
                updated_at: businessClock.nowISO() 
              })
              .in('id', servicesToRevert.map(s => s.id));

            if (revertError) throw revertError;
          }
        }

        // 4. DESPUÉS revertir estado de cierres de 'invoiced' a 'closed'
        const { error: closureRevertError } = await supabase
          .from('service_closures')
          .update({ status: 'closed', updated_at: businessClock.nowISO() })
          .in('id', closureIds)
          .eq('status', 'invoiced');

        if (closureRevertError) throw closureRevertError;
      }

      // 4b. También revertir servicios vinculados directamente via invoice_services
      const { data: directServices, error: directServicesError } = await supabase
        .from('invoice_services')
        .select('service_id')
        .eq('invoice_id', id);

      if (directServicesError) throw directServicesError;

      if (directServices && directServices.length > 0) {
        const directServiceIds = directServices.map(ds => ds.service_id);
        const { error: revertDirectError } = await supabase
          .from('services')
          .update({ 
            status: 'completed', 
            invoice_folio: null,
            invoice_numero_fiscal: null,
            updated_at: businessClock.nowISO() 
          })
          .in('id', directServiceIds)
          .eq('status', 'invoiced');

        if (revertDirectError) throw revertDirectError;

        // Eliminar relaciones invoice_services
        const { error: deleteDirectError } = await supabase
          .from('invoice_services')
          .delete()
          .eq('invoice_id', id);
        if (deleteDirectError) throw deleteDirectError;
      }

      // 5. Eliminar relaciones invoice_closures
      const { error: relationError } = await supabase
        .from('invoice_closures')
        .delete()
        .eq('invoice_id', id);

      if (relationError) throw relationError;

      // 6. Finalmente eliminar la factura
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

      // Invalidar queries de facturación Y servicios (datos de factura cambiaron)
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['closures'] });
      queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-service-details'] });
      queryClient.invalidateQueries({ queryKey: ['serviceDetails'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      
      toast.success("Factura anulada", {
        description: "La factura ha sido anulada y los servicios están disponibles para nueva facturación.",
      });
    } catch (error: any) {
      logger.error('Error al eliminar factura:', error);
      
      if (error.code === 'PROTECTED_INVOICE') {
        toast.error("Factura protegida", {
          description: "Esta factura fue creada en la app y no puede eliminarse directamente. Usa la confirmación reforzada.",
        });
      } else if (!error.message?.includes('permission denied')) {
        toast.error("No se pudo eliminar la factura", {
          description: error.message || "Ocurrió un error inesperado. Intenta nuevamente.",
        });
      }
      throw error;
    }
  };

  const markAsPaid = async (id: string, paymentDate?: string) => {
    try {
      const rpcParams: any = { p_invoice_id: id };
      if (paymentDate) {
        rpcParams.p_payment_date = paymentDate;
      }
      
      const { data, error } = await supabase.rpc('create_automatic_payment_for_invoice', rpcParams);

      if (error) {
        logger.error('Error en create_automatic_payment_for_invoice:', error);
        throw error;
      }

      const result = data as any;
      assertAutomaticPaymentSucceeded(result);

      // Dispatch event for real-time updates
      window.dispatchEvent(new CustomEvent('invoice-paid', { 
        detail: { invoiceId: id, paymentId: result?.payment_id } 
      }));
      
      toast.success("Factura pagada", {
        description: "La factura ha sido marcada como pagada y el pago registrado automáticamente.",
      });

      return { status: 'paid' as const, updatedAt: businessClock.nowISO() };
    } catch (error: any) {
      logger.error('Error marking invoice as paid:', error);
      toast.error("Error al marcar como pagada", {
        description: error.message || "No se pudo marcar la factura como pagada.",
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
