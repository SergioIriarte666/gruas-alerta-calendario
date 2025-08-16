import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Supplier } from '@/types/supplierPayments';

interface SupplierFilters {
  search?: string;
  is_active?: boolean;
  payment_terms?: string[];
}

interface SupplierFormData {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  rut: string;
  payment_terms?: string;
  delivery_time_days?: number;
  is_active: boolean;
}

// Hook para obtener todos los proveedores
export const useSuppliers = (filters?: SupplierFilters) => {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: async () => {
      let query = supabase
        .from('inventory_suppliers')
        .select('*')
        .order('name');

      // Aplicar filtros
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,rut.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%`);
      }

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.payment_terms?.length) {
        query = query.in('payment_terms', filters.payment_terms);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }

      return data as Supplier[];
    },
  });
};

// Hook para obtener un proveedor específico
export const useSupplier = (id: string) => {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching supplier:', error);
        throw error;
      }

      return data as Supplier;
    },
    enabled: !!id,
  });
};

// Hook para crear proveedor
export const useCreateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplierData: SupplierFormData) => {
      // Validar RUT único
      const { data: existingSupplier } = await supabase
        .from('inventory_suppliers')
        .select('id')
        .eq('rut', supplierData.rut)
        .single();

      if (existingSupplier) {
        throw new Error('Ya existe un proveedor con este RUT');
      }

      const { data, error } = await supabase
        .from('inventory_suppliers')
        .insert(supplierData)
        .select()
        .single();

      if (error) {
        console.error('Error creating supplier:', error);
        throw error;
      }

      return data as Supplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(`Proveedor "${data.name}" creado exitosamente`);
    },
    onError: (error: Error) => {
      toast.error(`Error al crear proveedor: ${error.message}`);
    },
  });
};

// Hook para actualizar proveedor
export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...supplierData }: SupplierFormData & { id: string }) => {
      // Validar RUT único (excluyendo el proveedor actual)
      const { data: existingSupplier } = await supabase
        .from('inventory_suppliers')
        .select('id')
        .eq('rut', supplierData.rut)
        .neq('id', id)
        .single();

      if (existingSupplier) {
        throw new Error('Ya existe otro proveedor con este RUT');
      }

      const { data, error } = await supabase
        .from('inventory_suppliers')
        .update(supplierData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating supplier:', error);
        throw error;
      }

      return data as Supplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.id] });
      toast.success(`Proveedor "${data.name}" actualizado exitosamente`);
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar proveedor: ${error.message}`);
    },
  });
};

// Hook para eliminar proveedor
export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar si el proveedor tiene facturas asociadas
      const { data: invoices } = await supabase
        .from('supplier_invoices')
        .select('id')
        .eq('supplier_id', id)
        .limit(1);

      if (invoices && invoices.length > 0) {
        throw new Error('No se puede eliminar el proveedor porque tiene facturas asociadas');
      }

      const { error } = await supabase
        .from('inventory_suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting supplier:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor eliminado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar proveedor: ${error.message}`);
    },
  });
};

// Hook para activar/desactivar proveedor
export const useToggleSupplierStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('inventory_suppliers')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error toggling supplier status:', error);
        throw error;
      }

      return data as Supplier;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.id] });
      const status = data.is_active ? 'activado' : 'desactivado';
      toast.success(`Proveedor "${data.name}" ${status} exitosamente`);
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar estado del proveedor: ${error.message}`);
    },
  });
};

// Hook para obtener estadísticas de proveedores
export const useSupplierStats = () => {
  return useQuery({
    queryKey: ['supplier-stats'],
    queryFn: async () => {
      const { data: suppliers, error: suppliersError } = await supabase
        .from('inventory_suppliers')
        .select('id, is_active');

      if (suppliersError) throw suppliersError;

      const { data: invoices, error: invoicesError } = await supabase
        .from('supplier_invoices')
        .select('supplier_id, amount, status');

      if (invoicesError) throw invoicesError;

      const totalSuppliers = suppliers?.length || 0;
      const activeSuppliers = suppliers?.filter(s => s.is_active).length || 0;
      const inactiveSuppliers = totalSuppliers - activeSuppliers;

      const totalInvoices = invoices?.length || 0;
      const totalAmount = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      const pendingInvoices = invoices?.filter(inv => inv.status === 'pending').length || 0;

      return {
        totalSuppliers,
        activeSuppliers,
        inactiveSuppliers,
        totalInvoices,
        totalAmount,
        pendingInvoices,
      };
    },
  });
};