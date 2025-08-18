import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  SupplierPayment, 
  SupplierPaymentWithDetails,
  PaymentFormData,
  SupplierPaymentStatus 
} from '@/types/suppliers';

export const useSupplierPayments = (supplierId?: string) => {
  const queryClient = useQueryClient();

  const paymentsQuery = useQuery({
    queryKey: ['supplier-payments', supplierId],
    queryFn: async (): Promise<any[]> => {
      let query = supabase
        .from('supplier_payments')
        .select('*')
        .order('due_date', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData): Promise<SupplierPayment> => {
      const { data: newPayment, error } = await supabase
        .from('supplier_payments')
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return newPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Pago registrado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating payment:', error);
      toast.error('Error al registrar pago');
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentFormData> }): Promise<SupplierPayment> => {
      const { data: updatedPayment, error } = await supabase
        .from('supplier_payments')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Pago actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error updating payment:', error);
      toast.error('Error al actualizar pago');
    }
  });

  const markPaymentAsPaidMutation = useMutation({
    mutationFn: async ({ id, paid_date, paid_amount }: { id: string; paid_date?: string; paid_amount?: number }) => {
      const { error } = await supabase
        .from('supplier_payments')
        .update({
          status: 'paid',
          paid_date: paid_date || new Date().toISOString().split('T')[0],
          paid_amount: paid_amount
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Pago marcado como pagado');
    },
    onError: (error) => {
      console.error('Error marking payment as paid:', error);
      toast.error('Error al marcar pago como pagado');
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('supplier_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Pago eliminado exitosamente');
    },
    onError: (error) => {
      console.error('Error deleting payment:', error);
      toast.error('Error al eliminar pago');
    }
  });

  const updateOverduePaymentsMutation = useMutation({
    mutationFn: async () => {
      // Update overdue payments manually for now
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('supplier_payments')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', today);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Pagos vencidos actualizados');
    },
    onError: (error) => {
      console.error('Error updating overdue payments:', error);
      toast.error('Error al actualizar pagos vencidos');
    }
  });

  return {
    payments: paymentsQuery.data || [],
    isLoading: paymentsQuery.isLoading,
    error: paymentsQuery.error,
    createPayment: createPaymentMutation.mutate,
    updatePayment: updatePaymentMutation.mutate,
    markPaymentAsPaid: markPaymentAsPaidMutation.mutate,
    deletePayment: deletePaymentMutation.mutate,
    updateOverduePayments: updateOverduePaymentsMutation.mutate,
    isCreating: createPaymentMutation.isPending,
    isUpdating: updatePaymentMutation.isPending,
    isDeleting: deletePaymentMutation.isPending
  };
};

export const getStatusLabel = (status: SupplierPaymentStatus): string => {
  const labels: Record<SupplierPaymentStatus, string> = {
    pending: 'Pendiente',
    paid: 'Pagado',
    overdue: 'Vencido',
    cancelled: 'Cancelado'
  };
  return labels[status];
};

export const getStatusColor = (status: SupplierPaymentStatus): string => {
  const colors: Record<SupplierPaymentStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    paid: 'bg-green-500/20 text-green-300 border-green-500/30',
    overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
    cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  };
  return colors[status];
};