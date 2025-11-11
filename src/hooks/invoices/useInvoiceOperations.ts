
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData, generateInvoiceFolio } from '@/utils/invoiceUtils';
import { useQueryClient } from '@tanstack/react-query';

export const useInvoiceOperations = () => {
  const queryClient = useQueryClient();

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>): Promise<Invoice> => {
    try {
      console.log('🚀 Starting invoice creation with transaction:', invoiceData);

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
        console.error('❌ Error al obtener servicios del cierre:', closureError);
        throw new Error('Error al obtener servicios del cierre');
      }

      if (!closureServices || closureServices.length === 0) {
        throw new Error('No se encontraron servicios en el cierre especificado');
      }

      const serviceIds = closureServices.map(cs => cs.service_id);
      console.log('📋 Servicios a facturar:', serviceIds);

      // Preparar datos para la transacción
      const invoiceDataForTransaction = {
        client_id: invoiceData.clientId,
        issue_date: invoiceData.issueDate,
        due_date: invoiceData.dueDate,
        subtotal: invoiceData.subtotal.toString(),
        vat: invoiceData.vat.toString(),
        total: invoiceData.total.toString(),
        numero_fiscal: invoiceData.numeroFiscal,
        status: invoiceData.status || 'draft',
        payment_term_id: invoiceData.paymentTermId || null,
        notes: null
      };

      // Usar función transaccional que maneja folio correctamente
      const { data: transactionResult, error: transactionError } = await supabase
        .rpc('create_invoice_transaction', {
          p_invoice_data: invoiceDataForTransaction,
          p_service_ids: serviceIds
        });

      if (transactionError) {
        console.error('❌ Error en transacción de factura:', transactionError);
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

      console.log('✅ Transacción de factura exitosa:', result);

      // Obtener la factura creada
      const { data: newInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
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
        console.error('❌ Error al crear relación invoice_closures:', closureRelationError);
        throw new Error('Error al relacionar factura con cierre');
      }

      console.log('🔗 Relación invoice_closures creada');

      // NUEVO: Actualizar estado del cierre a 'invoiced'
      const { error: closureUpdateError } = await supabase
        .from('service_closures')
        .update({ 
          status: 'invoiced',
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceData.closureId);

      if (closureUpdateError) {
        console.error('❌ Error al actualizar estado del cierre:', closureUpdateError);
        toast.warning("Advertencia", {
          description: "La factura se creó correctamente, pero no se pudo actualizar el estado del cierre.",
        });
      } else {
        console.log('✅ Estado del cierre actualizado a "invoiced"');
      }

      // Invalidar queries de React Query para refresh inmediato
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['operatorServices'] }),
        queryClient.invalidateQueries({ queryKey: ['crane-services'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] })
      ]);

      // Dispatch del evento custom para otros listeners
      window.dispatchEvent(new CustomEvent('invoice-created', { 
        detail: { invoiceId: newInvoice.id, serviceIds } 
      }));

      console.log('🎉 Factura creada exitosamente con folios consecutivos');
      
      toast.success("Factura creada", {
        description: `Factura ${result.invoice_folio} creada exitosamente.`,
      });

      return formatInvoiceData({ ...newInvoice, invoice_closures: [{ closure_id: invoiceData.closureId }] });

    } catch (error: any) {
      console.error('❌ Error general en createInvoice:', error);
      toast.error("Error al crear factura", {
        description: error.message || "No se pudo crear la factura.",
      });
      throw error;
    }
  };

  const updateInvoice = async (id: string, invoiceData: Partial<Invoice>) => {
    // Validate input parameters first
    if (!id || !invoiceData || Object.keys(invoiceData).length === 0) {
      throw new Error('ID de factura y datos de actualización son requeridos');
    }

    // Start transaction-like operations with error rollback capability
    let originalState: any = null;
    
    try {
      console.log('useInvoiceOperations - Starting invoice update transaction for:', id);
      
      // Step 1: Get current state for validation and rollback purposes
      const { data: currentInvoice, error: getCurrentError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (getCurrentError) {
        throw new Error(`Error obteniendo factura actual: ${getCurrentError.message}`);
      }

      if (!currentInvoice) {
        throw new Error('Factura no encontrada');
      }

      originalState = { ...currentInvoice };

      const { data: currentClosure, error: getCurrentClosureError } = await supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', id)
        .single();

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

      console.log('useInvoiceOperations - Validated update data:', updateData);

      // Step 4: Execute main invoice update
      const { data: updateResult, error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select()
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

      let finalClosureId = currentClosure.closure_id;

      // Step 5: Handle closure relationship changes with atomic operations
      if (invoiceData.closureId !== undefined && invoiceData.closureId !== currentClosure.closure_id) {
        console.log('Processing closure relationship change');
        
        try {
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

          // Update closure relationship
          const { error: relationError } = await supabase
            .from('invoice_closures')
            .update({ closure_id: invoiceData.closureId })
            .eq('invoice_id', id);

          if (relationError) {
            throw new Error(`Error actualizando relación de cierre: ${relationError.message}`);
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

          const results = await Promise.all(updatePromises);
          console.log('✅ Todos los servicios actualizados correctamente:', results);
        }
      } catch (servicesError) {
        console.error('Error updating services, but invoice update succeeded:', servicesError);
        // Don't rollback invoice here, just log the service update error
        toast.error("Advertencia", {
          description: "Factura actualizada pero algunos servicios pueden necesitar sincronización manual.",
        });
      }

      // Step 7: Invalidate caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] })
      ]);

      console.log('✅ Invoice update transaction completed successfully');
      toast.success("Factura actualizada", {
        description: "La factura ha sido actualizada exitosamente.",
      });

      return { ...invoiceData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('❌ Invoice update transaction failed:', error);
      
      // Show specific error messages
      toast.error("Error al actualizar factura", {
        description: error.message || "No se pudo actualizar la factura.",
      });
      
      throw error;
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      console.log('Iniciando eliminación de factura con reversión de estados:', id);

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

        // 3. PRIMERO revertir estado de servicios de 'invoiced' a 'completed'
        if (serviceIds.length > 0) {
          const { data: servicesToRevert, error: checkError } = await supabase
            .from('services')
            .select('id, folio, status')
            .in('id', serviceIds)
            .eq('status', 'invoiced');

          if (checkError) throw checkError;
          
          console.log('Servicios encontrados para revertir:', servicesToRevert?.length || 0);

          if (servicesToRevert && servicesToRevert.length > 0) {
            const { error: revertError } = await supabase
              .from('services')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .in('id', servicesToRevert.map(s => s.id));

            if (revertError) throw revertError;
            console.log('Revertidos', servicesToRevert.length, 'servicios a estado completed');
          }
        }

        // 4. DESPUÉS revertir estado de cierres de 'invoiced' a 'closed'
        const { error: closureRevertError } = await supabase
          .from('service_closures')
          .update({ status: 'closed', updated_at: new Date().toISOString() })
          .in('id', closureIds)
          .eq('status', 'invoiced');

        if (closureRevertError) throw closureRevertError;
        console.log('Revertidos', closureIds.length, 'cierres a estado closed');
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

      // 7. Invalidar queries para actualizar UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['closures'] })
      ]);
      
      toast.success("Factura anulada", {
        description: "La factura ha sido anulada y los servicios están disponibles para nueva facturación.",
      });
    } catch (error: any) {
      console.error('Error al anular factura:', error);
      
      if (!error.message?.includes('permission denied')) {
        toast.error("Error al anular factura", {
          description: error.message || "No se pudo anular la factura.",
        });
      }
      throw error;
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      console.log('Marcando factura como pagada:', id);
      
      const { data, error } = await supabase.rpc('create_automatic_payment_for_invoice', {
        p_invoice_id: id
      });

      if (error) {
        console.error('Error en create_automatic_payment_for_invoice:', error);
        throw error;
      }

      console.log('Pago automático creado y aplicado:', data);

      // Dispatch event for real-time updates
      const result = data as any;
      window.dispatchEvent(new CustomEvent('invoice-paid', { 
        detail: { invoiceId: id, paymentId: result?.payment_id } 
      }));
      
      toast.success("Factura pagada", {
        description: "La factura ha sido marcada como pagada y el pago registrado automáticamente.",
      });

      console.log('Factura marcada como pagada exitosamente');
      return { status: 'paid' as const, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
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
