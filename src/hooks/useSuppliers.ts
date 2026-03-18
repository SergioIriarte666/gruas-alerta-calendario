import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Supplier, SupplierFormData } from '@/types/suppliers';
import { dedupeSuppliersByIdentity, findSupplierByIdentity, normalizeSupplierRut } from '@/utils/supplierIdentity';

/**
 * Unified suppliers hook - reads from inventory_suppliers (single source of truth)
 */

const mapRowToSupplier = (row: any): Supplier => ({
  ...row,
  contact_name: row.contact_person, // UI alias
  category: row.category || 'otros',
});

const getSupplierCompletenessScore = (supplier: Partial<Supplier>) => {
  const normalizedRut = normalizeSupplierRut(supplier.rut);

  return [
    normalizedRut.length >= 8 ? 3 : normalizedRut.length > 0 ? 2 : 0,
    supplier.email ? 1 : 0,
    supplier.phone ? 1 : 0,
    supplier.address ? 1 : 0,
    supplier.contact_name || (supplier as any).contact_person ? 1 : 0,
    supplier.notes ? 1 : 0,
  ].reduce((total, value) => total + value, 0);
};

const pickPreferredSupplier = (current: Supplier, incoming: Supplier): Supplier => {
  const currentScore = getSupplierCompletenessScore(current);
  const incomingScore = getSupplierCompletenessScore(incoming);

  if (incomingScore > currentScore) return incoming;
  if (currentScore > incomingScore) return current;

  const currentDate = new Date(current.updated_at || current.created_at || 0).getTime();
  const incomingDate = new Date(incoming.updated_at || incoming.created_at || 0).getTime();

  return incomingDate >= currentDate ? incoming : current;
};

const sortSuppliers = (suppliers: Supplier[]) => suppliers.sort((a, b) => a.name.localeCompare(b.name, 'es'));

const fetchSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await (supabase as any)
    .from('inventory_suppliers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const mappedSuppliers = (data || []).map(mapRowToSupplier);
  return sortSuppliers(dedupeSuppliersByIdentity(mappedSuppliers, pickPreferredSupplier));
};

export const useSuppliers = () => {
  const queryClient = useQueryClient();

  const {
    data: suppliers = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const existingSupplier = findSupplierByIdentity(suppliers, { name: data.name, rut: data.rut || '' });
      if (existingSupplier) {
        return { ...existingSupplier, __reused: true } as Supplier & { __reused?: boolean };
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data: result, error } = await (supabase as any)
        .from('inventory_suppliers')
        .insert([{
          name: data.name,
          rut: data.rut || '',
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          contact_person: data.contact_name || null,
          category: data.category || 'otros',
          subcategory: data.subcategory || null,
          notes: data.notes || null,
          is_active: data.is_active ?? true,
          created_by: userId,
        }])
        .select()
        .single();

      if (error) throw error;
      return mapRowToSupplier(result);
    },
    onSuccess: (newSupplier) => {
      const wasReused = (newSupplier as Supplier & { __reused?: boolean }).__reused === true;

      queryClient.setQueryData<Supplier[]>(['suppliers'], (old) => {
        const prev = old || [];
        return sortSuppliers(dedupeSuppliersByIdentity([...prev, newSupplier], pickPreferredSupplier));
      });

      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success(wasReused ? 'Proveedor existente reutilizado' : 'Proveedor creado exitosamente');
    },
    onError: (error: any) => {
      console.error('Error creating supplier:', error);
      toast.error('Error al crear el proveedor');
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SupplierFormData> }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const updateData: any = { ...data, updated_by: userId };
      // Remap contact_name → contact_person
      if ('contact_name' in updateData) {
        updateData.contact_person = updateData.contact_name;
        delete updateData.contact_name;
      }
      
      const { data: result, error } = await (supabase as any)
        .from('inventory_suppliers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapRowToSupplier(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Proveedor actualizado exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating supplier:', error);
      toast.error('Error al actualizar el proveedor');
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('inventory_suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Proveedor eliminado exitosamente');
    },
    onError: (error: any) => {
      console.error('Error deleting supplier:', error);
      toast.error('Error al eliminar el proveedor');
    },
  });

  const toggleSupplierStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: current, error: fetchError } = await (supabase as any)
        .from('inventory_suppliers')
        .select('is_active')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { data, error } = await (supabase as any)
        .from('inventory_suppliers')
        .update({ 
          is_active: !current.is_active,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapRowToSupplier(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      toast.success('Estado del proveedor actualizado');
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
    createSupplierAsync: createSupplierMutation.mutateAsync,
    updateSupplier: updateSupplierMutation.mutate,
    deleteSupplier: deleteSupplierMutation.mutate,
    toggleSupplierStatus: toggleSupplierStatusMutation.mutate,
    isCreating: createSupplierMutation.isPending,
    isUpdating: updateSupplierMutation.isPending,
    isDeleting: deleteSupplierMutation.isPending
  };
};
