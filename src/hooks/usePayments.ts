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

      if (error) throw error;
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

  return {
    payments,
    loading,
    paymentSystemAvailable,
    createPayment,
    applyPaymentFIFO,
    applyPaymentManual,
    getUnpaidInvoicesForClient,
    checkPaymentSystemAvailability,
    syncExistingPaidInvoices,
    getClientPaymentHistory,
    cleanupDuplicatePayments,
    syncPaidInvoicesWithPayments,
    getReconciliationStats,
    fullPaymentCleanupAndSync,
    refetch: fetchPayments
  };
};