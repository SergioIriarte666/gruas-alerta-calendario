import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaymentFormData, SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { toast } from 'sonner';
import { useCostInvalidation } from './useCostInvalidation';

export const getStatusLabel = (status: SupplierPaymentStatus): string => {
  const labels = {
    pending: 'Pendiente',
    paid: 'Pagado',
    overdue: 'Vencido',
    cancelled: 'Cancelado'
  };
  return labels[status] || status;
};

export const getStatusColor = (status: SupplierPaymentStatus): string => {
  const colors = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    paid: 'bg-green-500/20 text-green-300 border-green-500/30',
    overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
    cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  };
  return colors[status] || colors.pending;
};

export const useSupplierPayments = () => {
  const queryClient = useQueryClient();
  const { invalidateAllCostQueries } = useCostInvalidation();

  const paymentsQuery = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: async (): Promise<SupplierPayment[]> => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return (data || []) as SupplierPayment[];
    }
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData): Promise<SupplierPayment> => {
      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: data.supplier_id,
          amount: data.amount,
          due_date: data.due_date,
          description: data.description,
          category: data.category,
          reference_number: data.reference_number || null,
          notes: data.notes || null,
          status: data.status || 'pending',
          created_by: (await supabase.auth.getUser()).data.user?.id
        } as any) // Temporary any to bypass type issues
        .select()
        .single();

      if (error) throw error;
      return payment as SupplierPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Pago creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating payment:', error);
      toast.error('Error al crear el pago');
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentFormData> }): Promise<SupplierPayment> => {
      // Filtrar campos que no existen en la tabla supplier_payments
      const { part_name, part_quantity, part_unit_price, crane_id, ...paymentData } = data;
      
      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .update(paymentData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return payment as SupplierPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Pago actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error updating payment:', error);
      toast.error('Error al actualizar el pago');
    }
  });

  const markPaymentAsPaidMutation = useMutation({
    mutationFn: async ({ id, paid_amount }: { id: string; paid_amount: number }) => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          paid_amount
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      // Invalidar también las queries de costos ya que se creará automáticamente un costo
      invalidateAllCostQueries();
      toast.success('Pago marcado como pagado - Se registrará automáticamente en costos');
    },
    onError: (error) => {
      console.error('Error marking payment as paid:', error);
      toast.error('Error al marcar el pago como pagado');
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Pago eliminado exitosamente');
    },
    onError: (error) => {
      console.error('Error deleting payment:', error);
      toast.error('Error al eliminar el pago');
    }
  });

  const updateOverduePaymentsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_overdue_supplier_payments');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
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