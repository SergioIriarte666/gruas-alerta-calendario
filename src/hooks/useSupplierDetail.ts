import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPPLIER_PAYMENTS_SELECT = `
  id,
  description,
  reference_number,
  amount,
  due_date,
  paid_date,
  status,
  category
`;

const SUPPLIER_INVOICES_SELECT = `
  id,
  invoice_number,
  issue_date,
  due_date,
  amount,
  paid_amount,
  balance,
  status
`;

const SUPPLIER_INVENTORY_MOVEMENTS_SELECT = `
  id,
  movement_date,
  movement_type,
  quantity,
  total_cost,
  reference_document,
  inventory_items(name, sku, unit_of_measure),
  inventory_locations(name)
`;

const SUPPLIER_CRANE_PARTS_SELECT = `
  id,
  date,
  part_name,
  quantity,
  unit_price,
  total_value,
  notes,
  cranes(license_plate, brand, model)
`;

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
        .select(SUPPLIER_PAYMENTS_SELECT)
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
        .select(SUPPLIER_INVOICES_SELECT)
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
        .select(SUPPLIER_INVENTORY_MOVEMENTS_SELECT)
        .eq('supplier_id', supplierId)
        .eq('status', 'active')
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
        .select(SUPPLIER_CRANE_PARTS_SELECT)
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

  // Calculate stats from invoices (primary source for debt)
  invoices.forEach((invoice) => {
    // Skip cancelled invoices
    if (invoice.status === 'cancelled') return;

    const amount = invoice.amount || 0;
    const paidAmount = invoice.paid_amount || 0;
    const balance = invoice.balance !== null ? invoice.balance : (amount - paidAmount);
    
    // Add paid amount
    stats.totalPaid += paidAmount;
    if (paidAmount >= amount && amount > 0) {
      stats.paidCount++;
    }

    // Add pending/overdue amount
    if (balance > 0) {
      if (invoice.due_date && new Date(invoice.due_date) < today) {
        stats.totalOverdue += balance;
        stats.overdueCount++;
      } else {
        stats.totalPending += balance;
        stats.pendingCount++;
      }
    }
  });

  // Calculate stats from standalone payments (payments not linked to invoices or generic payments)
  // Note: This logic assumes that if a payment is linked to an invoice, the invoice's paid_amount is updated.
  // If not, we might need to sum payments directly. 
  // However, usually we want to track debt via invoices.
  // Let's add unallocated payments to totalPaid if necessary, but strictly speaking, totalPaid should reflect
  // money out.
  // For now, to avoid double counting if the system updates invoice.paid_amount, we will rely on invoices for "Paid" stats related to invoices.
  // But we should also count payments that are NOT linked to any invoice (advances, etc).
  
  /* 
    If we want to strictly follow the "payments" table for totalPaid:
    stats.totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    stats.paidCount = payments.filter(p => p.status === 'paid').length;
    
    But this ignores the "Pending" debt which comes from Invoices.
    The hybrid approach above (using invoices) is better for "Account Standing".
  */



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
