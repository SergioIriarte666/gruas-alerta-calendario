import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupplierPayment } from '@/types/suppliers';
import { toast } from 'sonner';
import { useCostInvalidation } from './useCostInvalidation';

export interface PendingPaymentWithSupplier extends SupplierPayment {
  supplier_name?: string;
}

export const usePendingPayments = (supplierId?: string) => {
  const queryClient = useQueryClient();
  const { invalidateAllCostQueries } = useCostInvalidation();

  // Fetch pending and overdue payments
  const pendingPaymentsQuery = useQuery({
    queryKey: ['pending-payments', supplierId],
    queryFn: async (): Promise<PendingPaymentWithSupplier[]> => {
      let query = supabase
        .from('supplier_payments')
        .select(`
          *,
          suppliers!inner(name)
        `)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform to include supplier_name
      return (data || []).map(item => ({
        ...item,
        supplier_name: (item.suppliers as any)?.name || 'Sin proveedor'
      })) as PendingPaymentWithSupplier[];
    }
  });

  // Register payment for multiple payments
  const registerPaymentMutation = useMutation({
    mutationFn: async ({
      paymentIds,
      paymentDate,
      bankReference,
      paymentMethod,
      notes
    }: {
      paymentIds: string[];
      paymentDate: string;
      bankReference?: string;
      paymentMethod?: string;
      notes?: string;
    }) => {
      // Update all selected payments to paid status
      const { error } = await supabase
        .from('supplier_payments')
        .update({
          status: 'paid',
          paid_date: paymentDate,
          paid_reference: bankReference || null,
          payment_method: paymentMethod || null,
          notes: notes ? `${notes}` : undefined
        })
        .in('id', paymentIds);

      if (error) throw error;

      return paymentIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      invalidateAllCostQueries();
      toast.success(`${count} pago(s) registrado(s) exitosamente`);
    },
    onError: (error) => {
      console.error('Error registering payments:', error);
      toast.error('Error al registrar los pagos');
    }
  });

  return {
    pendingPayments: pendingPaymentsQuery.data || [],
    isLoading: pendingPaymentsQuery.isLoading,
    error: pendingPaymentsQuery.error,
    registerPayment: registerPaymentMutation.mutate,
    isRegistering: registerPaymentMutation.isPending
  };
};
