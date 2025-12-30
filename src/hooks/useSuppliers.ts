import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Supplier, SupplierFormData } from '@/types/suppliers';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineFetch, offlineCreate, offlineUpdate, offlineDelete, generateTempId } from '@/services/offlineOperations';

const fetchSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

export const useSuppliers = () => {
  const queryClient = useQueryClient();
  const { effectiveIsOnline } = useOfflineMode();

  const {
    data: suppliers = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<Supplier>(
        'suppliers',
        effectiveIsOnline,
        fetchSuppliers,
        (rawData) => rawData
      );
      
      if (isFromCache && data.length > 0) {
        toast.info('Datos desde cache local', { 
          description: `${data.length} proveedores cargados offline`,
          duration: 2000
        });
      }
      
      return data;
    },
    retry: effectiveIsOnline ? 2 : 0,
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (effectiveIsOnline) {
        const { data: result, error } = await supabase
          .from('suppliers')
          .insert([{
            ...data,
            created_by: (await supabase.auth.getUser()).data.user?.id
          } as any])
          .select()
          .single();

        if (error) throw error;
        return result;
      }
      
      // MODO OFFLINE
      console.log('[useSuppliers] Offline mode - creating locally');
      const tempId = generateTempId();
      
      const offlineSupplier = {
        id: tempId,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _isOffline: true,
      };

      const result = await offlineCreate<any>(
        'suppliers',
        offlineSupplier,
        false
      );

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      
      const isOffline = (data as any)?._isOffline;
      if (isOffline) {
        toast.success('Proveedor guardado localmente', {
          description: 'Se sincronizará al reconectar'
        });
      } else {
        toast.success('Proveedor creado exitosamente');
      }
    },
    onError: (error: any) => {
      console.error('Error creating supplier:', error);
      toast.error('Error al crear el proveedor');
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SupplierFormData> }) => {
      if (effectiveIsOnline) {
        const { data: result, error } = await supabase
          .from('suppliers')
          .update({
            ...data,
            updated_by: (await supabase.auth.getUser()).data.user?.id,
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return result;
      }
      
      // MODO OFFLINE
      console.log('[useSuppliers] Offline mode - updating locally');
      
      const result = await offlineUpdate<any>(
        'suppliers',
        id,
        { ...data, _isOffline: true, updated_at: new Date().toISOString() },
        false
      );

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      
      const isOffline = (data as any)?._isOffline;
      if (isOffline) {
        toast.success('Cambios guardados localmente', {
          description: 'Se sincronizarán al reconectar'
        });
      } else {
        toast.success('Proveedor actualizado exitosamente');
      }
    },
    onError: (error: any) => {
      console.error('Error updating supplier:', error);
      toast.error('Error al actualizar el proveedor');
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      if (effectiveIsOnline) {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return { isOffline: false };
      }
      
      // MODO OFFLINE
      console.log('[useSuppliers] Offline mode - deleting locally');
      
      const result = await offlineDelete(
        'suppliers',
        id,
        false
      );

      return { isOffline: true };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      
      if (result?.isOffline) {
        toast.success('Eliminación guardada localmente', {
          description: 'Se sincronizará al reconectar'
        });
      } else {
        toast.success('Proveedor eliminado exitosamente');
      }
    },
    onError: (error: any) => {
      console.error('Error deleting supplier:', error);
      toast.error('Error al eliminar el proveedor');
    },
  });

  const toggleSupplierStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primero obtener el estado actual del cache
      const currentSupplier = suppliers.find(s => s.id === id);
      
      if (!currentSupplier) {
        throw new Error('Proveedor no encontrado');
      }

      const newStatus = !currentSupplier.is_active;

      if (effectiveIsOnline) {
        const { data, error } = await supabase
          .from('suppliers')
          .update({ 
            is_active: newStatus,
            updated_by: (await supabase.auth.getUser()).data.user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
      
      // MODO OFFLINE
      console.log('[useSuppliers] Offline mode - toggling status locally');
      
      const result = await offlineUpdate<any>(
        'suppliers',
        id,
        { is_active: newStatus, _isOffline: true, updated_at: new Date().toISOString() },
        false
      );

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      
      const isOffline = (data as any)?._isOffline;
      if (isOffline) {
        toast.success('Cambio guardado localmente', {
          description: 'Se sincronizará al reconectar'
        });
      } else {
        toast.success('Estado del proveedor actualizado');
      }
    },
    onError: (error: any) => {
      console.error('Error toggling supplier status:', error);
      toast.error('Error al cambiar el estado del proveedor');
    },
  });

  return {
    suppliers,
    isLoading,
    error,
    createSupplier: createSupplierMutation.mutate,
    updateSupplier: updateSupplierMutation.mutate,
    deleteSupplier: deleteSupplierMutation.mutate,
    toggleSupplierStatus: toggleSupplierStatusMutation.mutate,
    isCreating: createSupplierMutation.isPending,
    isUpdating: updateSupplierMutation.isPending,
    isDeleting: deleteSupplierMutation.isPending
  };
};
