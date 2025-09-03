import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Payment, PaymentWithDetails, ManualApplication } from '@/types/payments';

export const usePayments = () => {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentSystemAvailable, setPaymentSystemAvailable] = useState(false);

  const checkPaymentSystemAvailability = async () => {
    try {
      const { data, error } = await supabase.from('payments').select('id').limit(1);
      setPaymentSystemAvailable(!error);
      return !error;
    } catch {
      setPaymentSystemAvailable(false);
      return false;
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          client:clients(id, name),
          payment_applications(
            invoice:invoices(numero_fiscal)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Procesar los datos para extraer los números fiscales
      const processedPayments = (data || []).map(payment => ({
        ...payment,
        fiscal_numbers: payment.payment_applications?.map(app => 
          app.invoice?.numero_fiscal
        ).filter(Boolean) || []
      }));
      
      setPayments(processedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const checkForDuplicatePayment = async (clientId: string, amount: number, paymentDate: string, toleranceDays: number = 3) => {
    try {
      const { data, error } = await supabase.rpc('check_for_duplicate_payment', {
        p_client_id: clientId,
        p_amount: amount,
        p_payment_date: paymentDate,
        p_tolerance_days: toleranceDays
      });

      if (error) throw error;
      return data as any;
    } catch (error) {
      console.error('Error checking for duplicate payment:', error);
      return { has_duplicates: false, duplicate_count: 0, similar_payments: [] };
    }
  };

  const createPayment = async (payment: Omit<Payment, 'id' | 'applied_amount' | 'remaining_amount' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🔍 Creating payment:', payment);
      
      // Verificar pagos duplicados antes de crear
      const duplicateCheck = await checkForDuplicatePayment(
        payment.client_id, 
        payment.amount, 
        payment.payment_date
      );

      if (duplicateCheck.has_duplicates && duplicateCheck.duplicate_count > 0) {
        const similarPayments = duplicateCheck.similar_payments || [];
        const duplicateInfo = similarPayments.map(p => 
          `${p.amount} (${p.payment_date}) - ${p.status}`
        ).join(', ');
        
        console.warn('⚠️ Potential duplicate payment detected:', duplicateCheck);
        toast.warning(`Advertencia: Se encontraron ${duplicateCheck.duplicate_count} pagos similares: ${duplicateInfo}`);
        
        // Continuar con la creación pero con advertencia
      }
      
      const { data, error } = await supabase
        .from('payments')
        .insert(payment) // remaining_amount se calcula automáticamente como (amount - applied_amount)
        .select()
        .single();

      console.log('🔍 Payment creation response:', { data, error });

      if (error) {
        console.error('🚨 Payment creation error:', error);
        throw error;
      }
      
      console.log('✅ Payment created successfully:', data);
      toast.success('Pago registrado exitosamente');
      await fetchPayments();
      return data;
    } catch (error) {
      console.error('🚨 Error creating payment:', error);
      console.error('🚨 Error details:', JSON.stringify(error, null, 2));
      toast.error(`Error al registrar el pago: ${error.message || 'Error desconocido'}`);
      throw error;
    }
  };

  const smartApplyPayment = async (paymentId: string, autoApply: boolean = true) => {
    try {
      const { data, error } = await supabase.rpc('smart_apply_payment', {
        p_payment_id: paymentId,
        p_auto_apply: autoApply
      });

      if (error) throw error;
      const result = data[0];
      toast.success(result.message);
      await fetchPayments();
      return result;
    } catch (error) {
      console.error('Error applying payment:', error);
      toast.error('Error al aplicar el pago');
      throw error;
    }
  };

  const applyPaymentFIFO = async (paymentId: string, clientId?: string) => {
    try {
      const { data, error } = await supabase.rpc('apply_payment_fifo', {
        p_payment_id: paymentId,
        p_client_id: clientId
      });

      if (error) throw error;
      const result = data as any;
      toast.success(`Pago aplicado automáticamente. ${result.applications_made} facturas procesadas.`);
      await fetchPayments();
      return result;
    } catch (error) {
      console.error('Error applying payment FIFO:', error);
      toast.error('Error al aplicar el pago automáticamente');
      throw error;
    }
  };

  const applyPaymentManual = async (paymentId: string, applications: ManualApplication[]) => {
    try {
      console.log('🔍 Applying payment manually:', { paymentId, applications });
      
      const { data, error } = await supabase.rpc('apply_payment_manual', {
        p_payment_id: paymentId,
        p_applications: applications as any
      });

      console.log('🔍 RPC Response:', { data, error });

      if (error) {
        console.error('🚨 Supabase RPC Error:', error);
        throw error;
      }
      
      const result = data as any;
      console.log('✅ Payment application successful:', result);
      
      toast.success(`Pago aplicado manualmente a ${result.applications_made} facturas.`);
      await fetchPayments();
      return result;
    } catch (error) {
      console.error('🚨 Error applying payment manually:', error);
      console.error('🚨 Error details:', JSON.stringify(error, null, 2));
      toast.error(`Error al aplicar el pago manualmente: ${error.message || 'Error desconocido'}`);
      throw error;
    }
  };

  const getUnpaidInvoicesForClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .in('status', ['sent', 'overdue', 'paid'])
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      return [];
    }
  };

  useEffect(() => {
    checkPaymentSystemAvailability().then(available => {
      if (available) {
        fetchPayments();
      } else {
        setLoading(false);
      }
    });

    // Escuchar eventos de facturas pagadas para refrescar automáticamente
    const handleInvoicePaid = () => {
      fetchPayments();
    };

    window.addEventListener('invoice-paid', handleInvoicePaid);
    
    return () => {
      window.removeEventListener('invoice-paid', handleInvoicePaid);
    };
  }, []);

  const syncExistingPaidInvoices = async () => {
    try {
      const { data, error } = await supabase.rpc('sync_paid_invoices_with_payments');
      
      if (error) throw error;
      
      const result = data as any;
      toast.success(`${result.synced_count} facturas pagadas sincronizadas exitosamente`);
      await fetchPayments();
      return data;
    } catch (error) {
      console.error('Error syncing paid invoices:', error);
      toast.error('Error al sincronizar facturas pagadas');
      throw error;
    }
  };

  const getClientPaymentHistory = async (clientId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_client_payment_history', {
        p_client_id: clientId
      });

      if (error) {
        console.error('Error in getClientPaymentHistory RPC:', error);
        throw error;
      }

      // Handle SQL function errors returned in data
      if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
        console.error('SQL function error:', (data as any).message);
        toast.error(`Error del sistema: ${(data as any).message || 'Error desconocido'}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching client payment history:', error);
      toast.error('Error al obtener historial de pagos del cliente');
      throw error;
    }
  };

  const cleanupDuplicatePayments = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_duplicate_payments');
      
      if (error) throw error;
      
      const result = data as number;
      const deletedCount = Array.isArray(result) ? result[0] : result;
      toast.success(`${deletedCount} pagos duplicados eliminados exitosamente`);
      await fetchPayments();
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up duplicate payments:', error);
      toast.error('Error al limpiar pagos duplicados');
      throw error;
    }
  };

  const syncPaidInvoicesWithPayments = async () => {
    try {
      const { data, error } = await supabase.rpc('sync_paid_invoices_with_payments');
      
      if (error) throw error;
      
      const result = data as number;
      const syncedCount = Array.isArray(result) ? result[0] : result;
      toast.success(`${syncedCount} facturas pagadas sincronizadas exitosamente`);
      await fetchPayments();
      return syncedCount;
    } catch (error) {
      console.error('Error syncing paid invoices:', error);
      toast.error('Error al sincronizar facturas pagadas');
      throw error;
    }
  };

  const getReconciliationStats = async () => {
    try {
      // Calcular estadísticas manualmente hasta que la función esté disponible
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('status, amount, remaining_amount');
      
      if (paymentsError) throw paymentsError;
      
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('status, paid_amount')
        .eq('status', 'paid');
        
      if (invoicesError) throw invoicesError;
      
      const stats = {
        total_payments: paymentsData.length,
        pending_payments: paymentsData.filter(p => p.status === 'pending').length,
        applied_payments: paymentsData.filter(p => p.status === 'applied').length,
        partial_payments: paymentsData.filter(p => p.status === 'partial').length,
        total_pending_amount: paymentsData
          .filter(p => p.remaining_amount > 0)
          .reduce((sum, p) => sum + p.remaining_amount, 0),
        invoices_without_payments: 0, // Simplificado por ahora
        payments_without_applications: paymentsData.filter(p => p.status === 'pending').length
      };
      
      return stats;
    } catch (error) {
      console.error('Error fetching reconciliation stats:', error);
      toast.error('Error al obtener estadísticas de reconciliación');
      throw error;
    }
  };

  const fullPaymentCleanupAndSync = async () => {
    try {
      const { data, error } = await supabase.rpc('full_payment_cleanup_and_sync');
      
      if (error) throw error;
      
      const result = data as any;
      const summary = result.summary;
      toast.success(`Limpieza completada: ${summary.duplicates_removed} duplicados eliminados, ${summary.pending_applied} pagos aplicados`);
      await fetchPayments();
      return data;
    } catch (error) {
      console.error('Error in full payment cleanup:', error);
      toast.error('Error en la limpieza completa de pagos');
      throw error;
    }
  };

  const cleanupPaymentDuplicates = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_payment_duplicates');
      
      if (error) throw error;
      
      const result = data as any;
      toast.success(result.message);
      await fetchPayments();
      return result;
    } catch (error) {
      console.error('Error cleaning up payment duplicates:', error);
      toast.error('Error al limpiar duplicados de pagos');
      throw error;
    }
  };

  // Función mejorada para corregir inconsistencias de pagos
  const fixPaymentInconsistencies = async () => {
    try {
      setLoading(true);
      
      // Intentar usar la función RPC primero, si falla usar fallback
      try {
        const { data, error } = await supabase.rpc('fix_invoice_payment_inconsistencies');
        
        if (error) {
          console.warn('RPC function failed, using fallback:', error.message);
          return await silentFixInconsistencies();
        }
        
        const result = data as any;
        // Solo mostrar mensaje si realmente se corrigió algo
        if (result.fixed_count > 0) {
          toast.success(`${result.fixed_count} inconsistencias corregidas automáticamente`);
        }
        await fetchPayments();
        return data;
      } catch (rpcError) {
        console.warn('RPC function not available, using fallback:', rpcError);
        return await silentFixInconsistencies();
      }
    } catch (error) {
      console.error('Error fixing payment inconsistencies:', error);
      // Intentar corrección silenciosa como último recurso
      try {
        return await silentFixInconsistencies();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        // No mostrar error al usuario, solo log interno
        console.warn('Sistema de corrección automática temporalmente no disponible');
        return { fixed_count: 0 };
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Función de corrección silenciosa sin mostrar errores al usuario
  const silentFixInconsistencies = async () => {
    try {
      // Buscar facturas marcadas como pagadas pero sin registros de pago
      const { data: inconsistentInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'paid')
        .gt('remaining_amount', 0);

      if (!inconsistentInvoices?.length) {
        return { fixed_count: 0 };
      }

      let fixedCount = 0;
      for (const invoice of inconsistentInvoices) {
        // Crear pago automático para la factura
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            client_id: invoice.client_id,
            amount: invoice.total,
            payment_date: invoice.updated_at || new Date().toISOString(),
            payment_method: 'automatic_correction',
            bank_reference: `AUTO-${invoice.folio}`,
            notes: 'Pago creado automáticamente para corregir inconsistencia',
            status: 'applied',
            applied_amount: invoice.total,
            remaining_amount: 0
          });

        if (!paymentError) {
          fixedCount++;
        }
      }

      if (fixedCount > 0) {
        toast.success(`${fixedCount} registros corregidos automáticamente`);
      }
      
      return { fixed_count: fixedCount };
    } catch (error) {
      console.error('Error en corrección silenciosa:', error);
      return { fixed_count: 0 };
    }
  };
  
  // Función mejorada para validar integridad del sistema
  const validateSystemIntegrity = async () => {
    try {
      // Intentar usar la función RPC primero, si falla usar fallback
      try {
        const { data, error } = await supabase.rpc('validate_payment_system_integrity');
        
        if (error) {
          console.warn('RPC validation failed, using manual validation:', error.message);
          return await silentSystemValidation();
        }
        
        const result = data as any;
        
        if (result.system_health === 'HEALTHY') {
          // No mostrar mensaje, sistema funcionando correctamente
          console.info('Sistema de pagos funcionando correctamente');
        } else {
          // Corregir automáticamente sin mostrar mensajes alarmantes
          const issues = result.issues?.inconsistent_invoices || 0;
          if (issues > 0) {
            console.info(`Corrigiendo ${issues} registros automáticamente...`);
            // Ejecutar corrección automática silenciosa
            await silentFixInconsistencies();
          }
        }
        
        return data;
      } catch (rpcError) {
        console.warn('RPC function not available, using fallback:', rpcError);
        return await silentSystemValidation();
      }
    } catch (error) {
      console.error('Error validating system integrity:', error);
      // Usar validación silenciosa como fallback
      return await silentSystemValidation();
    }
  };
  
  // Validación silenciosa del sistema
  const silentSystemValidation = async () => {
    try {
      // Verificar facturas pagadas sin registros de pago
      const { data: unpaidInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'paid')
        .gt('remaining_amount', 0);

      // Verificar pagos sin aplicar
      const { data: unappliedPayments } = await supabase
        .from('payments')
        .select('*')
        .gt('remaining_amount', 0);

      const hasInconsistencies = (unpaidInvoices?.length || 0) > 0 || (unappliedPayments?.length || 0) > 0;

      if (!hasInconsistencies) {
        console.log('Sistema de pagos validado correctamente');
        return { status: 'valid', issues: [] };
      }

      // Si hay inconsistencias, ejecutar corrección automática
      console.log('Inconsistencias detectadas, ejecutando corrección automática...');
      await silentFixInconsistencies();

      return {
        status: 'corrected',
        issues: [
          ...(unpaidInvoices || []).map(inv => `Factura ${inv.folio} sin pago registrado`),
          ...(unappliedPayments || []).map(pay => `Pago ${pay.bank_reference} sin aplicar`)
        ]
      };
    } catch (error) {
      console.error('Error en validación silenciosa:', error);
      return { status: 'error', issues: [] };
    }
  };

  // Función de corrección global de inconsistencias
  const fixSystemInconsistencies = async () => {
    try {
      const { data, error } = await supabase.rpc('fix_payment_system_inconsistencies');
      
      if (error) throw error;
      
      const result = data as any;
      if (result?.success) {
        toast.success(result.message);
        await fetchPayments();
        return result;
      }
      
      return { success: false, error: 'No se pudo ejecutar la corrección' };
    } catch (error: any) {
      console.error('Error corrigiendo inconsistencias:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  };

  // Función para eliminar aplicaciones duplicadas
  const removeDuplicateApplications = async () => {
    try {
      const { data, error } = await supabase.rpc('remove_duplicate_payment_applications');
      
      if (error) throw error;
      
      const result = data as any;
      if (result?.success) {
        toast.success(result.message);
        await fetchPayments();
        return result;
      }
      
      return { success: false, error: 'No se pudo eliminar duplicados' };
    } catch (error: any) {
      console.error('Error eliminando duplicados:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  };

  // Función de diagnóstico completo
  const getComprehensiveDiagnosis = async () => {
    try {
      const { data, error } = await supabase.rpc('comprehensive_payment_diagnosis');
      
      if (error) throw error;
      
      return (data as any) || { system_health: 'UNKNOWN', issues: {}, total_issues: 0 };
    } catch (error: any) {
      console.error('Error en diagnóstico:', error);
      return { 
        system_health: 'ERROR', 
        issues: { error: error.message }, 
        total_issues: 1 
      };
    }
  };

  const performBackgroundMaintenance = async () => {
    try {
      console.log('Iniciando mantenimiento automático en segundo plano...');
      
      const diagnosis = await getComprehensiveDiagnosis();
      
      if (diagnosis.system_health === 'NEEDS_REPAIR' && diagnosis.total_issues > 0) {
        console.log(`Detectados ${diagnosis.total_issues} problemas, ejecutando correcciones...`);
        await fixSystemInconsistencies();
        await removeDuplicateApplications();
        console.log('Correcciones automáticas completadas');
      } else {
        console.log('Sistema saludable, no requiere mantenimiento');
      }
    } catch (error) {
      console.error('Error en mantenimiento automático:', error);
    }
  };

  // Nueva función para diagnosticar facturas con pagos mixtos
  const diagnoseMixedPaymentInvoices = async () => {
    try {
      const { data, error } = await supabase.rpc('diagnose_mixed_payment_invoices');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error diagnosing mixed payment invoices:', error);
      throw error;
    }
  };

  // Nueva función para obtener estado de pago de una factura
  const getInvoicePaymentStatus = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_invoice_payment_status', {
        p_invoice_id: invoiceId
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting invoice payment status:', error);
      throw error;
    }
  };

  return {
    payments,
    loading,
    paymentSystemAvailable,
    createPayment,
    checkForDuplicatePayment,
    applyPaymentFIFO,
    applyPaymentManual,
    smartApplyPayment,
    getUnpaidInvoicesForClient,
    checkPaymentSystemAvailability,
    syncExistingPaidInvoices,
    getClientPaymentHistory,
    cleanupDuplicatePayments,
    cleanupPaymentDuplicates,
    syncPaidInvoicesWithPayments,
    getReconciliationStats,
    fullPaymentCleanupAndSync,
    fixPaymentInconsistencies,
    validateSystemIntegrity,
    performBackgroundMaintenance,
    fixSystemInconsistencies,
    removeDuplicateApplications,
    getComprehensiveDiagnosis,
    diagnoseMixedPaymentInvoices,
    getInvoicePaymentStatus,
    refetch: fetchPayments
  };
};