
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { Database } from '@/integrations/supabase/types';
import { Operator } from '@/types';
import { toast } from 'sonner';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineCreate, offlineUpdate, offlineDelete, generateTempId } from '@/services/offlineOperations';

type OperatorCreationData = Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>;
type OperatorUpdateData = Partial<OperatorCreationData>;

export const useOperatorMutations = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { effectiveIsOnline } = useOfflineMode();

  const onMutationSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['operators'] });
    toast.success("Éxito", {
      description: message,
    });
  };

  const onMutationError = (error: Error, message: string, operatorData?: any) => {
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
    console.error(error);
  };

  const createOperatorMutation = useMutation({
    mutationFn: async (operatorData: OperatorCreationData) => {
      if (effectiveIsOnline) {
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
            created_by: user?.id || null
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      
      // MODO OFFLINE
      console.log('[useOperatorMutations] Offline mode - creating locally');
      const tempId = generateTempId();
      
      const offlineOperator = {
        id: tempId,
        name: operatorData.name,
        rut: operatorData.rut,
        phone: operatorData.phone,
        operator_type: operatorData.operatorType || 'crane_operator',
        department: operatorData.department || null,
        position: operatorData.position || null,
        license_number: operatorData.licenseNumber || null,
        exam_expiry: operatorData.examExpiry || null,
        is_active: operatorData.isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _isOffline: true,
      };

      const result = await offlineCreate<any>(
        'operators',
        offlineOperator,
        false
      );

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      
      const isOffline = (data as any)?._isOffline;
      if (isOffline) {
        toast.success('Operador guardado localmente', {
          description: 'Se sincronizará al reconectar'
        });
      } else {
        toast.success("Éxito", {
          description: `Operador "${data.name}" creado exitosamente.`,
        });
      }
    },
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

      if (Object.keys(updateData).length === 0) return { _isOffline: false };

      if (effectiveIsOnline) {
        const { error } = await supabase
          .from('operators')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
        return { ...updateData, _isOffline: false };
      }
      
      // MODO OFFLINE
      console.log('[useOperatorMutations] Offline mode - updating locally');
      
      const result = await offlineUpdate<any>(
        'operators',
        id,
        { ...updateData, _isOffline: true, updated_at: new Date().toISOString() },
        false
      );

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      
      const isOffline = (data as any)?._isOffline;
      if (isOffline) {
        toast.success('Cambios guardados localmente', {
          description: 'Se sincronizarán al reconectar'
        });
      } else {
        toast.success("Éxito", {
          description: 'Operador actualizado exitosamente.',
        });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Operador',
      context: 'updateOperator'
    }),
  });

  const deleteOperatorMutation = useMutation({
    mutationFn: async (id: string) => {
      if (effectiveIsOnline) {
        const { error } = await supabase
          .from('operators')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return { isOffline: false };
      }
      
      // MODO OFFLINE
      console.log('[useOperatorMutations] Offline mode - deleting locally');
      
      await offlineDelete(
        'operators',
        id,
        false
      );

      return { isOffline: true };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      
      if (result?.isOffline) {
        toast.success('Eliminación guardada localmente', {
          description: 'Se sincronizará al reconectar'
        });
      } else {
        toast.success("Éxito", {
          description: 'Operador eliminado exitosamente.',
        });
      }
    },
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

      const newStatus = !operator.isActive;

      if (effectiveIsOnline) {
        const { error } = await supabase
          .from('operators')
          .update({ is_active: newStatus })
          .eq('id', id);

        if (error) throw error;
        return { ...operator, isActive: newStatus, _isOffline: false };
      }
      
      // MODO OFFLINE
      console.log('[useOperatorMutations] Offline mode - toggling status locally');
      
      const result = await offlineUpdate<any>(
        'operators',
        id,
        { is_active: newStatus, _isOffline: true, updated_at: new Date().toISOString() },
        false
      );

      return { ...operator, isActive: newStatus, _isOffline: true };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      
      const isOffline = (data as any)?._isOffline;
      const status = data.isActive ? 'activado' : 'desactivado';
      
      if (isOffline) {
        toast.success('Cambio guardado localmente', {
          description: 'Se sincronizará al reconectar'
        });
      } else {
        toast.success("Éxito", {
          description: `Operador "${data.name}" ${status} exitosamente.`,
        });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Cambiar Estado',
      context: 'toggleOperatorStatus'
    }),
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
