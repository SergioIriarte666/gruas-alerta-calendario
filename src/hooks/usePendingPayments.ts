import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupplierPayment } from '@/types/suppliers';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePendingPayments");
export interface PendingPaymentWithSupplier extends SupplierPayment {
  supplier_name?: string;
}

export const usePendingPayments = (supplierId?: string) => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();

  // Fetch pending and overdue payments
  const pendingPaymentsQuery = useQuery({
    queryKey: ['pending-payments', supplierId],
    queryFn: async (): Promise<PendingPaymentWithSupplier[]> => {
      let query = supabase
        .from('supplier_payments')
        .select(`
          *,
          inventory_suppliers!inner(name)
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
        supplier_name: (item.inventory_suppliers as any)?.name || 'Sin proveedor'
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
      // Build notes string with payment info
      const paymentNotes = [
        bankReference ? `Ref bancaria: ${bankReference}` : null,
        paymentMethod ? `Método: ${paymentMethod}` : null,
        notes || null
      ].filter(Boolean).join(' | ');

      // Get payments data before updating
      const paymentsData = pendingPaymentsQuery.data?.filter(p => paymentIds.includes(p.id)) || [];

      // Update each payment individually to set correct paid_amount
      for (const payment of paymentsData) {
        const { error } = await supabase
          .from('supplier_payments')
          .update({
            status: 'paid',
            paid_date: paymentDate,
            notes: paymentNotes || null,
            paid_amount: payment.amount
          })
          .eq('id', payment.id);

        if (error) throw error;
      }

      return paymentIds.length;
    },
    onSuccess: (count) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      toast.success(`${count} pago(s) registrado(s) exitosamente`);
    },
    onError: (error) => {
      logger.error('Error registering payments:', error);
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
