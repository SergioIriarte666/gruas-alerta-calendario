import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  SupplierPayment, 
  PaymentFormData,
  SupplierPaymentStatus 
} from '@/types/suppliers';

export const useSupplierPayments = () => {
  const queryClient = useQueryClient();

  const paymentsQuery = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: async (): Promise<SupplierPayment[]> => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*')
        .order('due_date', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData): Promise<SupplierPayment> => {
      const { data: newPayment, error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: data.supplier_id,
          amount: data.amount,
          due_date: data.due_date,
          description: data.description,
          category: data.category,
          reference_number: data.reference_number,
          notes: data.notes,
          status: data.status,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return newPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Pago creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating payment:', error);
      toast.error('Error al crear pago');
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentFormData> }): Promise<SupplierPayment> => {
      const { data: updatedPayment, error } = await supabase
        .from('supplier_payments')
        .update({
          ...data,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
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
    mutationFn: async ({ id, paid_amount }: { id: string; paid_amount: number }): Promise<void> => {
      const { error } = await supabase
        .from('supplier_payments')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          paid_amount,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
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
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('update_overdue_supplier_payments');
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