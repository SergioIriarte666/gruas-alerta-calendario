
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Operator } from '@/types';
import { toast } from 'sonner';

type OperatorCreationData = Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>;
type OperatorUpdateData = Partial<OperatorCreationData>;

export const useOperatorMutations = () => {
  const queryClient = useQueryClient();

  const onMutationSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['operators'] });
    toast.success("Éxito", {
      description: message,
    });
  };

  const onMutationError = (error: Error, message: string) => {
    toast.error("Error", {
      description: message,
    });
    console.error(error);
  };

  const createOperatorMutation = useMutation({
    mutationFn: async (operatorData: OperatorCreationData) => {
      const { data, error } = await supabase
        .from('operators')
        .insert({
          name: operatorData.name,
          rut: operatorData.rut,
          phone: operatorData.phone,
          email: operatorData.email || null,
          license_number: operatorData.licenseNumber,
          exam_expiry: operatorData.examExpiry,
          is_active: operatorData.isActive
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => onMutationSuccess(`Operador "${data.name}" creado exitosamente.`),
    onError: (error: Error) => onMutationError(error, 'No se pudo crear el operador.'),
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async ({ id, operatorData }: { id: string, operatorData: OperatorUpdateData }) => {
        const updateData: { [key: string]: any } = {};
        if (operatorData.name !== undefined) updateData.name = operatorData.name;
        if (operatorData.rut !== undefined) updateData.rut = operatorData.rut;
        if (operatorData.phone !== undefined) updateData.phone = operatorData.phone;
        if (operatorData.email !== undefined) updateData.email = operatorData.email || null;
        if (operatorData.licenseNumber !== undefined) updateData.license_number = operatorData.licenseNumber;
        if (operatorData.examExpiry !== undefined) updateData.exam_expiry = operatorData.examExpiry;
        if (operatorData.isActive !== undefined) updateData.is_active = operatorData.isActive;

        if (Object.keys(updateData).length === 0) return;

        const { error } = await supabase
            .from('operators')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
    },
    onSuccess: () => onMutationSuccess('Operador actualizado exitosamente.'),
    onError: (error: Error) => onMutationError(error, 'No se pudo actualizar el operador.'),
  });

  const deleteOperatorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operators')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => onMutationSuccess('Operador eliminado exitosamente.'),
    onError: (error: Error) => onMutationError(error, 'No se pudo eliminar el operador.'),
  });

  const toggleOperatorStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const operators = queryClient.getQueryData<Operator[]>(['operators']);
      const operator = operators?.find(o => o.id === id);
      if (!operator) throw new Error('Operador no encontrado');

      const { error } = await supabase
        .from('operators')
        .update({ is_active: !operator.isActive })
        .eq('id', id);

      if (error) throw error;
      return operator;
    },
    onSuccess: (operator) => {
        const status = operator.isActive ? 'desactivado' : 'activado';
        onMutationSuccess(`Operador "${operator.name}" ${status} exitosamente.`);
    },
    onError: (error: Error) => onMutationError(error, 'No se pudo cambiar el estado del operador.'),
  });

  return {
    createOperator: createOperatorMutation.mutate,
    updateOperator: updateOperatorMutation.mutate,
    deleteOperator: deleteOperatorMutation.mutate,
    toggleOperatorStatus: toggleOperatorStatusMutation.mutate,
    isCreating: createOperatorMutation.isPending,
    isUpdating: updateOperatorMutation.isPending,
    isDeleting: deleteOperatorMutation.isPending,
    isTogglingStatus: toggleOperatorStatusMutation.isPending,
  };
};
