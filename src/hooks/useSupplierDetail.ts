import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SupplierDetailStats {
  totalPending: number;
  totalPaid: number;
  totalOverdue: number;
  pendingCount: number;
  paidCount: number;
  overdueCount: number;
  inventoryMovementsCount: number;
  cranePartsCount: number;
}

export const useSupplierDetail = (supplierId: string | null, enabled = true) => {
  const isEnabled = !!supplierId && enabled;

  // Fetch supplier payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['supplier-detail-payments', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isEnabled,
  });

  // Fetch supplier invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['supplier-detail-invoices', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isEnabled,
  });

  // Fetch inventory movements
  const { data: inventoryMovements = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ['supplier-detail-inventory', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          inventory_items(name, sku, unit_of_measure),
          inventory_locations(name)
        `)
        .eq('supplier_id', supplierId)
        .order('movement_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isEnabled,
  });

  // Fetch crane parts
  const { data: craneParts = [], isLoading: partsLoading } = useQuery({
    queryKey: ['supplier-detail-parts', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('crane_parts')
        .select(`
          *,
          cranes(license_plate, brand, model)
        `)
        .eq('supplier_id', supplierId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isEnabled,
  });

  // Calculate stats
  const stats: SupplierDetailStats = {
    totalPending: 0,
    totalPaid: 0,
    totalOverdue: 0,
    pendingCount: 0,
    paidCount: 0,
    overdueCount: 0,
    inventoryMovementsCount: inventoryMovements.length,
    cranePartsCount: craneParts.length,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  payments.forEach((payment) => {
    const amount = payment.amount || 0;
    
    if (payment.status === 'paid') {
      stats.totalPaid += amount;
      stats.paidCount++;
    } else if (payment.status === 'overdue' || (payment.due_date && new Date(payment.due_date) < today && payment.status !== 'paid')) {
      stats.totalOverdue += amount;
      stats.overdueCount++;
    } else {
      stats.totalPending += amount;
      stats.pendingCount++;
    }
  });

  const isLoading = paymentsLoading || invoicesLoading || inventoryLoading || partsLoading;

  return {
    payments,
    invoices,
    inventoryMovements,
    craneParts,
    stats,
    isLoading,
  };
};
