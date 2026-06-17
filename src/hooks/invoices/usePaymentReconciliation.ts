import { useState, useEffect, useCallback } from 'react';
import { usePayments } from '@/hooks/usePayments';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import type { PaymentWithDetails } from '@/types/payments';

const logger = createLogger('usePaymentReconciliation');

export const usePaymentReconciliation = () => {
  const paymentsHook = usePayments();
  const { clients } = useClients();

  const [reconciliationStats, setReconciliationStats] = useState<any>(null);
  const [systemDiagnosis, setSystemDiagnosis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadReconciliationStats = useCallback(async () => {
    try {
      const stats = await paymentsHook.getReconciliationStats();
      setReconciliationStats(stats);
    } catch (error) {
      logger.error('Error loading reconciliation stats:', error);
    }
  }, [paymentsHook.getReconciliationStats]);

  const loadSystemDiagnosis = useCallback(async () => {
    try {
      const diagnosis = await paymentsHook.getComprehensiveDiagnosis();
      setSystemDiagnosis(diagnosis);
    } catch (error) {
      logger.error('Error loading system diagnosis:', error);
    }
  }, [paymentsHook.getComprehensiveDiagnosis]);

  useEffect(() => {
    loadReconciliationStats();
    loadSystemDiagnosis();
  }, []);

  const handleManualApplication = async (payment: PaymentWithDetails) => {
    try {
      const invoices = await paymentsHook.getUnpaidInvoicesForClient(payment.client_id);
      return { invoices, payment };
    } catch (error) {
      logger.error('Error loading invoices:', error);
      toast.error('Error al cargar facturas pendientes');
      return null;
    }
  };

  const handleSelectiveApplication = async (
    payment: PaymentWithDetails,
    fiscalNumbers: string[],
    applyOnlyToSpecified = true,
  ) => {
    await paymentsHook.applyPaymentSelective(payment.id, fiscalNumbers, applyOnlyToSpecified);
    await paymentsHook.refetch();
  };

  const performAutomaticMaintenance = async () => {
    setIsProcessing(true);
    try {
      await loadReconciliationStats();
      await loadSystemDiagnosis();
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    // From usePayments
    payments: paymentsHook.payments,
    paymentsLoading: paymentsHook.loading,
    paymentSystemAvailable: paymentsHook.paymentSystemAvailable,
    applyPaymentSelective: paymentsHook.applyPaymentSelective,
    getUnpaidInvoicesForClient: paymentsHook.getUnpaidInvoicesForClient,
    refetch: paymentsHook.refetch,

    // Clients
    clients,

    // Stats
    reconciliationStats,
    systemDiagnosis,
    isProcessing,
    loadReconciliationStats,
    loadSystemDiagnosis,
    performAutomaticMaintenance,

    // Handlers
    handleManualApplication,
    handleSelectiveApplication,
  };
};
