
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { Operator } from '@/types';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useOperatorMutations");
type OperatorCreationData = Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>;
type OperatorUpdateData = Partial<OperatorCreationData>;

export const useOperatorMutations = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  const onMutationSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['operators'] });
    toast.success("Éxito", {
      description: message,
    });
  };

  const _onMutationError = (error: Error, message: string, operatorData?: any) => {
    // Check for duplicate errors
    if ((error as any)?.code === '23505' || error?.message?.includes('duplicate key value')) {
      if (error?.message?.includes('rut')) {
        toast.error("Operador duplicado", {
          description: `Ya existe un operador registrado con el RUT ${operatorData?.rut || 'especificado'}.`,
        });
        return;
      }
      if (error?.message?.includes('license_number')) {
        toast.error("Operador duplicado", {
          description: `Ya existe un operador registrado con el número de licencia ${operatorData?.licenseNumber || 'especificado'}.`,
        });
        return;
      }
    }
    
    toast.error("Error", {
      description: message,
    });
    logger.error(error);
  };

  const createOperatorMutation = useMutation({
    mutationFn: async (operatorData: OperatorCreationData) => {
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('operators')
        .insert({
          name: operatorData.name,
          rut: operatorData.rut,
          phone: operatorData.phone,
          operator_type: operatorData.operatorType || 'crane_operator',
          department: operatorData.department || null,
          position: operatorData.position || null,
          license_number: operatorData.licenseNumber || null,
          exam_expiry: operatorData.examExpiry || null,
          is_active: operatorData.isActive,
          commission_exempt: operatorData.commissionExempt ?? false,
          tracking_enabled: operatorData.trackingEnabled ?? true,
          created_by: user?.id || null
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => onMutationSuccess(`Operador "${data.name}" creado exitosamente.`),
    onError: createMutationErrorHandler({
      title: 'Error al Crear Operador',
      context: 'createOperator'
    }),
  });

  const updateOperatorMutation = useMutation({
    mutationFn: async ({ id, operatorData }: { id: string, operatorData: OperatorUpdateData }) => {
        const updateData: { [key: string]: any } = {};
        if (operatorData.name !== undefined) updateData.name = operatorData.name;
        if (operatorData.rut !== undefined) updateData.rut = operatorData.rut;
        if (operatorData.phone !== undefined) updateData.phone = operatorData.phone;
        if (operatorData.operatorType !== undefined) updateData.operator_type = operatorData.operatorType;
        if (operatorData.department !== undefined) updateData.department = operatorData.department || null;
        if (operatorData.position !== undefined) updateData.position = operatorData.position || null;
        if (operatorData.licenseNumber !== undefined) updateData.license_number = operatorData.licenseNumber || null;
        if (operatorData.examExpiry !== undefined) updateData.exam_expiry = operatorData.examExpiry || null;
        if (operatorData.isActive !== undefined) updateData.is_active = operatorData.isActive;
        if (operatorData.commissionExempt !== undefined) updateData.commission_exempt = operatorData.commissionExempt;
        if (operatorData.trackingEnabled !== undefined) updateData.tracking_enabled = operatorData.trackingEnabled;

        if (Object.keys(updateData).length === 0) return;

        const { error } = await supabase
            .from('operators')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
    },
    onSuccess: () => onMutationSuccess('Operador actualizado exitosamente.'),
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Operador',
      context: 'updateOperator'
    }),
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
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Operador',
      context: 'deleteOperator'
    }),
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
    onError: createMutationErrorHandler({
      title: 'Error al Cambiar Estado',
      context: 'toggleOperatorStatus'
    }),
  });

  return {
    createOperator: createOperatorMutation.mutate,
    createOperatorAsync: createOperatorMutation.mutateAsync,
    updateOperator: updateOperatorMutation.mutate,
    updateOperatorAsync: updateOperatorMutation.mutateAsync,
    deleteOperator: deleteOperatorMutation.mutate,
    toggleOperatorStatus: toggleOperatorStatusMutation.mutate,
    isCreating: createOperatorMutation.isPending,
    isUpdating: updateOperatorMutation.isPending,
    isDeleting: deleteOperatorMutation.isPending,
    isTogglingStatus: toggleOperatorStatusMutation.isPending,
  };
};
