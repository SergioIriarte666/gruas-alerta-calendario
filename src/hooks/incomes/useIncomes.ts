import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { IncomeWithDetails, IncomeFormData } from '@/types/incomes';
import { toast } from 'sonner';

export const useIncomes = () => {
  return useQuery({
    queryKey: ['incomes'],
    queryFn: async (): Promise<IncomeWithDetails[]> => {
      const { data, error } = await supabase
        .from('incomes')
        .select(`
          *,
          category:income_categories(*),
          client:clients(id, name)
        `)
        .order('income_date', { ascending: false });

      if (error) throw error;
      return (data || []) as IncomeWithDetails[];
    },
  });
};

export const useCreateIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incomeData: IncomeFormData) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('incomes')
        .insert({
          ...incomeData,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast.success('Ingreso registrado exitosamente');
    },
    onError: (error) => {
      toast.error('Error al registrar ingreso', {
        description: error.message,
      });
    },
  });
};

export const useUpdateIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...incomeData }: IncomeFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('incomes')
        .update(incomeData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast.success('Ingreso actualizado exitosamente');
    },
    onError: (error) => {
      toast.error('Error al actualizar ingreso', {
        description: error.message,
      });
    },
  });
};

export const useDeleteIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast.success('Ingreso eliminado exitosamente');
    },
    onError: (error) => {
      toast.error('Error al eliminar ingreso', {
        description: error.message,
      });
    },
  });
};
