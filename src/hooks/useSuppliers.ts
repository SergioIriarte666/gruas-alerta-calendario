import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Supplier, 
  SupplierWithStats,
  SupplierFormData,
  SupplierCategory 
} from '@/types/suppliers';

export const useSuppliers = () => {
  const queryClient = useQueryClient();

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<SupplierWithStats[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          supplier_payments(
            amount,
            status
          )
        `)
        .order('name');

      if (error) throw error;

      return data.map(supplier => {
        const payments = supplier.supplier_payments || [];
        const pendingPayments = payments.filter((p: any) => p.status === 'pending');
        const paidPayments = payments.filter((p: any) => p.status === 'paid');
        const overduePayments = payments.filter((p: any) => p.status === 'overdue');

        return {
          ...supplier,
          total_payments: payments.length,
          pending_amount: pendingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
          paid_amount: paidPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
          overdue_count: overduePayments.length
        };
      });
    }
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData): Promise<Supplier> => {
      const { data: newSupplier, error } = await supabase
        .from('suppliers')
        .insert({
          name: data.name,
          rut: data.rut,
          email: data.email,
          phone: data.phone,
          address: data.address,
          contact_name: data.contact_name,
          category: data.category,
          notes: data.notes,
          is_active: data.is_active,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return newSupplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating supplier:', error);
      toast.error('Error al crear proveedor');
    }
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SupplierFormData> }): Promise<Supplier> => {
      const { data: updatedSupplier, error } = await supabase
        .from('suppliers')
        .update({
          ...data,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedSupplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error updating supplier:', error);
      toast.error('Error al actualizar proveedor');
    }
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor eliminado exitosamente');
    },
    onError: (error) => {
      console.error('Error deleting supplier:', error);
      toast.error('Error al eliminar proveedor');
    }
  });

  const toggleSupplierStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }): Promise<void> => {
      const { error } = await supabase
        .from('suppliers')
        .update({ 
          is_active,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(`Proveedor ${is_active ? 'activado' : 'desactivado'} exitosamente`);
    },
    onError: (error) => {
      console.error('Error toggling supplier status:', error);
      toast.error('Error al cambiar estado del proveedor');
    }
  });

  return {
    suppliers: suppliersQuery.data || [],
    isLoading: suppliersQuery.isLoading,
    error: suppliersQuery.error,
    createSupplier: createSupplierMutation.mutate,
    updateSupplier: updateSupplierMutation.mutate,
    deleteSupplier: deleteSupplierMutation.mutate,
    toggleSupplierStatus: toggleSupplierStatusMutation.mutate,
    isCreating: createSupplierMutation.isPending,
    isUpdating: updateSupplierMutation.isPending,
    isDeleting: deleteSupplierMutation.isPending
  };
};

export const useSupplierCategories = (): SupplierCategory[] => {
  return [
    'combustible',
    'mantenimiento', 
    'seguros',
    'peajes',
    'salarios',
    'administrativos',
    'impuestos',
    'comision_operador',
    'otros'
  ];
};

export const getCategoryLabel = (category: SupplierCategory): string => {
  const labels: Record<SupplierCategory, string> = {
    combustible: 'Combustible',
    mantenimiento: 'Mantenimiento',
    seguros: 'Seguros',
    peajes: 'Peajes',
    salarios: 'Salarios',
    administrativos: 'Administrativos',
    impuestos: 'Impuestos',
    comision_operador: 'Comisión Operador',
    otros: 'Otros'
  };
  return labels[category];
};