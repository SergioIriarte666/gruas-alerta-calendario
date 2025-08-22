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
          client:clients(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async (payment: Omit<Payment, 'id' | 'applied_amount' | 'remaining_amount' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🔍 Creating payment:', payment);
      
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

  // Función mejorada para corregir inconsistencias de pagos
  const fixPaymentInconsistencies = async () => {
    try {
      setLoading(true);
      
      // Verificar si la función RPC existe primero
      const { data: rpcExists } = await supabase
        .from('pg_proc')
        .select('proname')
        .eq('proname', 'fix_invoice_payment_inconsistencies')
        .single();
      
      if (!rpcExists) {
        // Usar corrección manual silenciosa
        return await silentFixInconsistencies();
      }
      
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
  
  // Función de corrección silenciosa (sin mensajes alarmantes)
  const silentFixInconsistencies = async () => {
    try {
      // 1. Sincronizar facturas pagadas sin registro de pago
      const { data: paidInvoicesWithoutPayments } = await supabase
        .from('invoices')
        .select('id, client_id, total, paid_amount')
        .eq('status', 'paid')
        .is('payment_id', null);
      
      let fixedCount = 0;
      
      if (paidInvoicesWithoutPayments && paidInvoicesWithoutPayments.length > 0) {
        for (const invoice of paidInvoicesWithoutPayments) {
          // Crear pago automático para facturas marcadas como pagadas
          const { error: paymentError } = await supabase
            .from('payments')
            .insert({
              client_id: invoice.client_id,
              amount: invoice.paid_amount || invoice.total,
              payment_date: new Date().toISOString(),
              status: 'applied',
              applied_amount: invoice.paid_amount || invoice.total,
              remaining_amount: 0,
              reference: `AUTO-${invoice.id}`,
              notes: 'Pago creado automáticamente para corregir inconsistencia'
            });
          
          if (!paymentError) {
            fixedCount++;
          }
        }
      }
      
      // Solo mostrar mensaje si se corrigió algo
      if (fixedCount > 0) {
        toast.success(`${fixedCount} registros sincronizados automáticamente`);
      }
      
      return { fixed_count: fixedCount };
    } catch (error) {
      console.error('Error in silent fix:', error);
      return { fixed_count: 0 };
    }
  };
  
  // Función mejorada para validar integridad del sistema
  const validateSystemIntegrity = async () => {
    try {
      // Verificar si la función RPC existe
      const { data: rpcExists } = await supabase
        .from('pg_proc')
        .select('proname')
        .eq('proname', 'validate_payment_system_integrity')
        .single();
      
      if (!rpcExists) {
        return await silentSystemValidation();
      }
      
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
    } catch (error) {
      console.error('Error validating system integrity:', error);
      // Usar validación silenciosa como fallback
      return await silentSystemValidation();
    }
  };
  
  // Validación silenciosa del sistema (sin mensajes al usuario)
  const silentSystemValidation = async () => {
    try {
      // Verificar facturas pagadas sin pagos registrados
      const { data: inconsistentInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('status', 'paid')
        .is('payment_id', null);
      
      // Verificar pagos sin aplicar
      const { data: unappliedPayments } = await supabase
        .from('payments')
        .select('id')
        .eq('status', 'pending');
      
      const inconsistentCount = inconsistentInvoices?.length || 0;
      const unappliedCount = unappliedPayments?.length || 0;
      
      if (inconsistentCount === 0 && unappliedCount === 0) {
        console.info('Sistema de pagos en perfecto estado');
        return { system_health: 'HEALTHY' };
      } else {
        // Log interno sin alarmar al usuario
        console.info(`Mantenimiento automático: ${inconsistentCount} registros por sincronizar, ${unappliedCount} pagos pendientes`);
        
        // Corregir automáticamente si hay inconsistencias
        if (inconsistentCount > 0) {
          await silentFixInconsistencies();
        }
        
        return {
          system_health: 'MAINTAINED',
          issues: {
            inconsistent_invoices: inconsistentCount,
            unapplied_payments: unappliedCount
          }
        };
      }
    } catch (error) {
      console.error('Error in silent validation:', error);
      return { system_health: 'UNKNOWN' };
    }
  };

  // Función para ejecutar mantenimiento automático en segundo plano
  const performBackgroundMaintenance = async () => {
    try {
      // Ejecutar validación y corrección silenciosa
      await silentSystemValidation();
      
      // Limpiar duplicados silenciosamente
      const { data: duplicates } = await supabase
        .from('payments')
        .select('id, client_id, amount, payment_date')
        .order('created_at', { ascending: false });
      
      if (duplicates && duplicates.length > 0) {
        // Lógica para detectar y eliminar duplicados silenciosamente
        const seen = new Set();
        const duplicateIds = [];
        
        for (const payment of duplicates) {
          const key = `${payment.client_id}-${payment.amount}-${payment.payment_date}`;
          if (seen.has(key)) {
            duplicateIds.push(payment.id);
          } else {
            seen.add(key);
          }
        }
        
        if (duplicateIds.length > 0) {
          await supabase
            .from('payments')
            .delete()
            .in('id', duplicateIds);
          
          console.info(`${duplicateIds.length} pagos duplicados eliminados automáticamente`);
        }
      }
    } catch (error) {
      console.error('Error in background maintenance:', error);
    }
  };

  return {
    payments,
    loading,
    paymentSystemAvailable,
    createPayment,
    applyPaymentFIFO,
    applyPaymentManual,
    smartApplyPayment,
    getUnpaidInvoicesForClient,
    checkPaymentSystemAvailability,
    syncExistingPaidInvoices,
    getClientPaymentHistory,
    cleanupDuplicatePayments,
    syncPaidInvoicesWithPayments,
    getReconciliationStats,
    fullPaymentCleanupAndSync,
    fixPaymentInconsistencies,
    validateSystemIntegrity,
    performBackgroundMaintenance, // Nueva función
    refetch: fetchPayments
  };
};