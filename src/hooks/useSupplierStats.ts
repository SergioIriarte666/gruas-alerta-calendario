import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupplierStats, SupplierCategory } from '@/types/suppliers';

export const useSupplierStats = () => {
  return useQuery({
    queryKey: ['supplier-stats'],
    queryFn: async (): Promise<SupplierStats> => {
      // Get supplier stats
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('category, is_active');

      if (suppliersError) throw suppliersError;

      // Get payment stats
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('supplier_payments')
        .select('status, amount, due_date');

      if (paymentsError) throw paymentsError;

      const totalSuppliers = suppliersData.length;
      const activeSuppliers = suppliersData.filter(s => s.is_active).length;

      const pendingPayments = paymentsData.filter(p => p.status === 'pending');
      const overduePayments = paymentsData.filter(p => p.status === 'overdue');

      const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Count suppliers by category
      const suppliersByCategory: Record<SupplierCategory, number> = {
        combustible: 0,
        mantenimiento: 0,
        seguros: 0,
        peajes: 0,
        salarios: 0,
        administrativos: 0,
        impuestos: 0,
        comision_operador: 0,
        otros: 0
      };

      suppliersData.forEach(supplier => {
        if (supplier.category && supplier.category in suppliersByCategory) {
          suppliersByCategory[supplier.category as SupplierCategory]++;
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
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });
};

export const useSupplierPaymentStats = (supplierId?: string) => {
  return useQuery({
    queryKey: ['supplier-payment-stats', supplierId],
    queryFn: async () => {
      // For now, return basic stats
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('supplier_id', supplierId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId
  });
};