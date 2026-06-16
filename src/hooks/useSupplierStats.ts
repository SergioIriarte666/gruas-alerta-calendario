import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupplierStats } from '@/types/suppliers';
import { businessClock } from '@/utils/businessClock';

interface ExtendedSupplierStats extends SupplierStats {
  total_paid_this_month: number;
  paid_count_this_month: number;
}

const fetchSupplierStats = async (): Promise<ExtendedSupplierStats> => {
  const { data: suppliers, error: suppliersError } = await supabase
    .from('inventory_suppliers')
    .select('id, is_active, category');

  if (suppliersError) throw suppliersError;

  const { data: payments, error: paymentsError } = await supabase
    .from('supplier_payments')
    .select('id, status, amount, due_date, paid_date, paid_amount');

  if (paymentsError) throw paymentsError;

  const totalSuppliers = suppliers?.length || 0;
  const activeSuppliers = suppliers?.filter((s: any) => s.is_active).length || 0;

  const pendingPayments = payments?.filter(p => p.status === 'pending') || [];
  const overduePayments = payments?.filter(p => p.status === 'overdue') || [];

  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Paid this month
  const now = businessClock.todayDate();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const paidThisMonth = (payments || []).filter(p => 
    p.status === 'paid' && p.paid_date && p.paid_date >= monthStart
  );
  const totalPaidThisMonth = paidThisMonth.reduce((sum, p) => sum + (p.paid_amount || p.amount || 0), 0);

  const suppliersByCategory: Record<string, number> = {};
  suppliers?.forEach((supplier: any) => {
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
    suppliers_by_category: suppliersByCategory,
    total_paid_this_month: totalPaidThisMonth,
    paid_count_this_month: paidThisMonth.length,
  };
};

export const useSupplierStats = () => {
  return useQuery({
    queryKey: ['supplier-stats'],
    queryFn: fetchSupplierStats,
    staleTime: 5 * 60 * 1000,
  });
};
