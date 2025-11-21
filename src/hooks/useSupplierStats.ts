import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupplierStats } from '@/types/suppliers';

const fetchSupplierStats = async (): Promise<SupplierStats> => {
  // Get basic supplier counts
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('id, is_active, category');

  if (suppliersError) throw suppliersError;

  // Get payment statistics
  const { data: payments, error: paymentsError } = await supabase
    .from('supplier_payments')
    .select('id, status, amount, due_date');

  if (paymentsError) throw paymentsError;

  const totalSuppliers = suppliers?.length || 0;
  const activeSuppliers = suppliers?.filter(s => s.is_active).length || 0;

  // Process payments
  const pendingPayments = payments?.filter(p => p.status === 'pending') || [];
  const overduePayments = payments?.filter(p => p.status === 'overdue') || [];

  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Group suppliers by category
  const suppliersByCategory: Record<string, number> = {};
  suppliers?.forEach(supplier => {
    if (supplier.category) {
      suppliersByCategory[supplier.category] = (suppliersByCategory[supplier.category] || 0) + 1;
    }
  });

  return {
    total_suppliers: totalSuppliers,
    active_suppliers: activeSuppliers,
    total_pending_payments: pendingPayments.length,
    total_pending_amount: totalPendingAmount,
    total_overdue_payments: overduePayments.length,
    total_overdue_amount: totalOverdueAmount,
    suppliers_by_category: suppliersByCategory
  };
};

export const useSupplierStats = () => {
  return useQuery({
    queryKey: ['supplier-stats'],
    queryFn: fetchSupplierStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};