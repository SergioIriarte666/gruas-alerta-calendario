import { supabase } from '@/integrations/supabase/client';
import { SupplierPaymentStatus } from '@/types/suppliers';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePaymentDuplicateCheck");
interface DuplicatePayment {
  id: string;
  supplier_id: string;
  reference_number: string;
  amount: number;
  due_date: string;
  status: SupplierPaymentStatus;
  description: string;
  created_at: string;
  paid_date: string | null;
}

interface DuplicateGroup {
  reference_number: string;
  supplier_id: string;
  supplier_name: string;
  payments: DuplicatePayment[];
}

export const usePaymentDuplicateCheck = () => {
  /**
   * Check if a payment with the same reference_number exists for a supplier
   */
  const checkDuplicate = async (
    referenceNumber: string, 
    supplierId: string,
    excludePaymentId?: string
  ): Promise<DuplicatePayment | null> => {
    if (!referenceNumber || !supplierId) return null;

    let query = supabase
      .from('supplier_payments')
      .select('id, supplier_id, reference_number, amount, due_date, status, description, created_at, paid_date')
      .eq('reference_number', referenceNumber)
      .eq('supplier_id', supplierId);

    if (excludePaymentId) {
      query = query.neq('id', excludePaymentId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error checking duplicate:', error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as DuplicatePayment;
    }

    return null;
  };

  /**
   * Find all groups of duplicate payments (same reference_number)
   */
  const findAllDuplicates = async (suppliers: { id: string; name: string }[]): Promise<DuplicateGroup[]> => {
    const { data: payments, error } = await supabase
      .from('supplier_payments')
      .select('id, supplier_id, reference_number, amount, due_date, status, description, created_at, paid_date')
      .not('reference_number', 'is', null)
      .neq('reference_number', '')
      .order('reference_number')
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error finding duplicates:', error);
      return [];
    }

    // Group payments by reference_number + supplier_id
    const groups: Record<string, DuplicatePayment[]> = {};
    
    for (const payment of payments || []) {
      const key = `${payment.supplier_id}|${payment.reference_number}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(payment as DuplicatePayment);
    }

    // Filter only groups with more than 1 payment (duplicates)
    const duplicateGroups: DuplicateGroup[] = [];
    
    for (const [key, groupPayments] of Object.entries(groups)) {
      if (groupPayments.length > 1) {
        const [supplierId, referenceNumber] = key.split('|');
        const supplier = suppliers.find(s => s.id === supplierId);
        
        duplicateGroups.push({
          reference_number: referenceNumber,
          supplier_id: supplierId,
          supplier_name: supplier?.name || 'Proveedor desconocido',
          payments: groupPayments
        });
      }
    }

    return duplicateGroups;
  };

  /**
   * Delete a payment by ID
   */
  const deletePayment = async (paymentId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('supplier_payments')
      .delete()
      .eq('id', paymentId);

    if (error) {
      logger.error('Error deleting payment:', error);
      return false;
    }

    return true;
  };

  /**
   * Cancel a payment (mark as cancelled instead of deleting)
   */
  const cancelPayment = async (paymentId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('supplier_payments')
      .update({ status: 'cancelled' })
      .eq('id', paymentId);

    if (error) {
      logger.error('Error cancelling payment:', error);
      return false;
    }

    return true;
  };

  return { 
    checkDuplicate, 
    findAllDuplicates, 
    deletePayment,
    cancelPayment
  };
};

export type { DuplicatePayment, DuplicateGroup };
