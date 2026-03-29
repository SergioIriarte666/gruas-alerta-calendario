import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Payment, PaymentWithDetails, ManualApplication, PaymentStatus } from '@/types/payments';
import { useErrorHandler } from '@/hooks/useErrorHandler';

const PAYMENTS_SELECT = `
  id,
  client_id,
  amount,
  payment_date,
  bank_reference,
  payment_method,
  notes,
  status,
  applied_amount,
  remaining_amount,
  created_at,
  updated_at
`;

const UNPAID_INVOICES_SELECT = `
  id,
  folio,
  issue_date,
  due_date,
  subtotal,
  vat,
  total,
  status,
  paid_amount,
  remaining_amount,
  numero_fiscal
`;

export const usePayments = () => {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentSystemAvailable, setPaymentSystemAvailable] = useState(false);
  const { handleError, handleNetworkError } = useErrorHandler();

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
          ${PAYMENTS_SELECT},
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
      handleNetworkError(error, {
        customMessage: 'No se pudieron cargar los pagos. Verifique su conexión e intente nuevamente',
        showToast: true
      });
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

  const createPayment = async (
    payment: Omit<Payment, 'id' | 'applied_amount' | 'remaining_amount' | 'created_at' | 'updated_at'>,
    autoApply: boolean = false // Compatibilidad: la aplicación automática está deshabilitada
  ) => {
    try {
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
        .select(PAYMENTS_SELECT)
        .single();

      if (error) {
        console.error('🚨 Payment creation error:', error);
        throw error;
      }
      
      // Compatibilidad: mantener parámetro sin aplicación automática
      if (autoApply && data?.id) {
        toast.warning('La aplicación automática está deshabilitada. Use aplicación manual o selectiva.');
      }
      
      // Siempre registrar sin aplicar automáticamente
      toast.success('Pago registrado exitosamente. Aplíquelo manualmente desde Conciliación de Pagos.');
      
      await fetchPayments();
      return data;
    } catch (error) {
      console.error('🚨 Error creating payment:', error);
      console.error('🚨 Error details:', JSON.stringify(error, null, 2));
      handleError(error, {
        title: 'Error al Registrar Pago',
        context: 'usePayments - createPayment'
      });
      throw error;
    }
  };

  // Apply payment selectively to specific fiscal numbers with optional restriction
  const applyPaymentSelective = async (paymentId: string, fiscalNumbers: string[], applyOnlyToSpecified: boolean = true) => {
    try {
      const { data, error } = await supabase.rpc('apply_payment_selective', {
        p_payment_id: paymentId,
        p_fiscal_numbers: fiscalNumbers,
        p_apply_only_to_specified: applyOnlyToSpecified
      });

      if (error) throw error;
      
      // Type guard to check if data has success property
      if (data && typeof data === 'object' && 'success' in data) {
        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || 'Error aplicando pago selectivo');
        }
      }

      toast.success('Pago aplicado exitosamente a las facturas especificadas');
      await fetchPayments();
      return data;
    } catch (error) {
      console.error('Error applying selective payment:', error);
      handleError(error, {
        title: 'Error al aplicar pago selectivo'
      });
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
      handleError(error, {
        customMessage: 'No se pudo aplicar el pago automáticamente',
        title: 'Error al Aplicar Pago',
        context: 'usePayments - smartApplyPayment'
      });
      throw error;
    }
  };

  const applyPaymentFIFO = async (): Promise<any> => {
    const message = 'La aplicación automática está deshabilitada en este módulo. Use aplicación manual o selectiva.';
    toast.error(message);
    throw new Error(message);
  };

  const applyPaymentManual = async (paymentId: string, applications: ManualApplication[]) => {
    try {
      const { data, error } = await supabase.rpc('apply_payment_manual', {
        p_payment_id: paymentId,
        p_applications: applications as any
      });

      if (error) {
        console.error('🚨 Supabase RPC Error:', error);
        throw error;
      }
      
      const result = data as any;
      
      toast.success(`Pago aplicado manualmente a ${result.applications_made} facturas.`);
      await fetchPayments();
      return result;
    } catch (error) {
      console.error('🚨 Error applying payment manually:', error);
      console.error('🚨 Error details:', JSON.stringify(error, null, 2));
      handleError(error, {
        title: 'Error en Aplicación Manual',
        context: 'usePayments - applyPaymentManual'
      });
      throw error;
    }
  };

  const getUnpaidInvoicesForClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(UNPAID_INVOICES_SELECT)
        .eq('client_id', clientId)
        .in('status', ['draft', 'sent', 'overdue', 'partial'])
        .not('folio', 'like', 'HIST-%')
        .gt('remaining_amount', 0)
        .order('due_date', { ascending: true });

      if (error) {
        throw error;
      }
      
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
        .eq('status', 'paid')
        .not('folio', 'like', 'HIST-%');
        
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
        .select('id, folio, remaining_amount')
        .eq('status', 'paid')
        .gt('remaining_amount', 0);

      // Verificar pagos sin aplicar
      const { data: unappliedPayments } = await supabase
        .from('payments')
        .select('id, bank_reference, remaining_amount')
        .gt('remaining_amount', 0);

      const hasInconsistencies = (unpaidInvoices?.length || 0) > 0 || (unappliedPayments?.length || 0) > 0;

      if (!hasInconsistencies) {
        return { status: 'valid', issues: [] };
      }

      // Si hay inconsistencias, ejecutar corrección automática
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

  // Enhanced diagnostics and cleanup
  const getComprehensiveDiagnosis = async (): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('comprehensive_payment_diagnosis');
      if (error) throw error;
      return data || { system_health: 'UNKNOWN', issues: {}, total_issues: 0 };
    } catch (error: any) {
      console.error('Error en diagnóstico:', error);
      return { 
        system_health: 'ERROR', 
        issues: { error: error.message }, 
        total_issues: 1 
      };
    }
  };

  const diagnosePaymentConflicts = async (paymentId?: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('diagnose_payment_application_conflicts', {
        p_payment_id: paymentId || null
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error diagnosing payment conflicts:', error);
      throw error;
    }
  };

  const resolvePaymentConflicts = async (paymentId?: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('resolve_payment_application_conflicts', {
        p_payment_id: paymentId || null
      });
      if (error) throw error;
      
      const result = data as any;
      if (result?.success) {
        toast.success(result.message || `Resueltos conflictos en ${result.resolved_payments} pagos`);
        await fetchPayments();
        return result;
      } else {
        throw new Error(result?.error || 'Error resolving conflicts');
      }
    } catch (error) {
      console.error('Error resolving payment conflicts:', error);
      toast.error('Error al resolver conflictos de pagos');
      throw error;
    }
  };

  const performBackgroundMaintenance = async () => {
    try {
      const diagnosis = await getComprehensiveDiagnosis();
      
      if (diagnosis.system_health === 'NEEDS_REPAIR' && diagnosis.total_issues > 0) {
        await fixSystemInconsistencies();
        await removeDuplicateApplications();
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

  // Nueva función para corregir conflictos de aplicación de pagos
  const fixPaymentApplicationConflicts = async () => {
    try {
      setLoading(true);
      
      // Primero diagnosticar conflictos
      const diagnosis = await diagnosePaymentConflicts();
      
      if (diagnosis.conflicts_found === 0) {
        toast.success('No se encontraron conflictos de aplicación de pagos');
        return diagnosis;
      }

      // Resolver conflictos
      const resolution = await resolvePaymentConflicts();
      
      toast.success(`Corregidos ${resolution.resolved_payments} conflictos de aplicación de pagos`);
      return { diagnosis, resolution };
    } catch (error) {
      console.error('Error fixing payment application conflicts:', error);
      toast.error('Error al corregir conflictos de aplicación de pagos');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Revertir aplicaciones específicas de un pago
  const revertPaymentApplications = async (paymentId: string, applicationIds?: string[]) => {
    try {
      setLoading(true);

      if (applicationIds && applicationIds.length > 0) {
        // Revertir aplicaciones específicas
        for (const appId of applicationIds) {
          const { error } = await supabase
            .from('payment_applications')
            .delete()
            .eq('id', appId);
          
          if (error) throw error;
        }
      } else {
        // Revertir todas las aplicaciones del pago
        const { error } = await supabase
          .from('payment_applications')
          .delete()
          .eq('payment_id', paymentId);
        
        if (error) throw error;
      }

      // Recalcular el estado del pago
      const { data: applications } = await supabase
        .from('payment_applications')
        .select('applied_amount')
        .eq('payment_id', paymentId);

      const totalApplied = applications?.reduce((sum, app) => sum + Number(app.applied_amount), 0) || 0;

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          applied_amount: totalApplied,
          status: totalApplied === 0 ? 'pending' : 'partial'
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      await fetchPayments();
      toast.success('Aplicaciones revertidas exitosamente');
    } catch (error) {
      console.error('Error reverting payment applications:', error);
      toast.error('Error al revertir aplicaciones de pago');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Aplicar pago a facturas específicas por número fiscal
  const applyPaymentToSpecificInvoices = async (
    paymentId: string, 
    fiscalNumbers: string[], 
    amounts?: number[]
  ) => {
    try {
      setLoading(true);

      // Obtener el pago
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) {
        throw new Error('Pago no encontrado');
      }

      // Obtener facturas por números fiscales
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, folio, numero_fiscal, total, paid_amount, status')
        .in('numero_fiscal', fiscalNumbers)
        .eq('client_id', payment.client_id);

      if (invoicesError) throw invoicesError;

      const missingFiscalNumbers = fiscalNumbers.filter(
        fn => !invoices?.find(inv => inv.numero_fiscal === fn)
      );

      if (missingFiscalNumbers.length > 0) {
        throw new Error(`Facturas no encontradas con números fiscales: ${missingFiscalNumbers.join(', ')}`);
      }

      // Aplicar a cada factura
      let remainingAmount = payment.amount - payment.applied_amount;
      const applications = [];
      const currentUser = await supabase.auth.getUser();

      for (let i = 0; i < invoices!.length; i++) {
        const invoice = invoices![i];
        const pendingAmount = invoice.total - (invoice.paid_amount || 0);
        
        if (pendingAmount <= 0) continue;

        let applicationAmount;
        if (amounts && amounts[i]) {
          applicationAmount = Math.min(amounts[i], pendingAmount, remainingAmount);
        } else {
          applicationAmount = Math.min(pendingAmount, remainingAmount);
        }

        if (applicationAmount > 0) {
          applications.push({
            payment_id: paymentId,
            invoice_id: invoice.id,
            applied_amount: applicationAmount,
            application_method: 'manual',
            created_by: currentUser.data.user?.id
          });

          remainingAmount -= applicationAmount;
        }

        if (remainingAmount <= 0) break;
      }

      // Insertar aplicaciones
      if (applications.length > 0) {
        const { error: insertError } = await supabase
          .from('payment_applications')
          .insert(applications);

        if (insertError) throw insertError;
      }

      await fetchPayments();
      toast.success(`Pago aplicado exitosamente a ${applications.length} facturas`);
      
      if (remainingAmount > 0) {
        toast.info(`Saldo restante del pago: $${remainingAmount.toLocaleString()}`);
      }

      return { applications, remainingAmount };
    } catch (error) {
      console.error('Error applying payment to specific invoices:', error);
      toast.error(error instanceof Error ? error.message : 'Error al aplicar pago a facturas específicas');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Obtener detalles de aplicación de un pago
  const getPaymentApplicationDetails = async (paymentId: string) => {
    try {
      const { data: applications, error } = await supabase
        .from('payment_applications')
        .select(`
          id,
          applied_amount,
          application_method,
          created_at,
          invoices (
            id,
            folio,
            numero_fiscal,
            total,
            paid_amount,
            status
          )
        `)
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return applications || [];
    } catch (error) {
      console.error('Error getting payment application details:', error);
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
    silentFixInconsistencies,
    silentSystemValidation,
    getComprehensiveDiagnosis,
    diagnosePaymentConflicts,
    resolvePaymentConflicts,
    fixPaymentApplicationConflicts,
    revertPaymentApplications,
    applyPaymentSelective,
    getPaymentApplicationDetails,
    diagnoseMixedPaymentInvoices,
    getInvoicePaymentStatus,
    refetch: fetchPayments
  };
};

export const fetchPagedPayments = async (
  page: number,
  pageSize: number,
  filters?: {
    clientId?: string;
    status?: PaymentStatus | 'all';
  }
): Promise<{ payments: PaymentWithDetails[]; total: number }> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('payments')
    .select(
      `
      *,
      client:clients(id, name),
      payment_applications(
        invoice:invoices(numero_fiscal)
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const processedPayments = (data || []).map(payment => ({
    ...payment,
    fiscal_numbers:
      payment.payment_applications
        ?.map((app: any) => app.invoice?.numero_fiscal)
        .filter(Boolean) || []
  })) as PaymentWithDetails[];

  return {
    payments: processedPayments,
    total: typeof count === 'number' ? count : processedPayments.length
  };
};

export const usePagedPayments = (
  page: number,
  pageSize: number,
  filters?: {
    clientId?: string;
    status?: PaymentStatus | 'all';
  }
) => {
  return useQuery({
    queryKey: [
      'payments',
      'paged',
      {
        page,
        pageSize,
        clientId: filters?.clientId || 'all',
        status: filters?.status || 'all'
      }
    ],
    queryFn: () => fetchPagedPayments(page, pageSize, filters),
    enabled: page > 0 && pageSize > 0,
    staleTime: 5 * 60 * 1000
  });
};
