import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { Database } from '@/integrations/supabase/types';

type CreateSupplierInvoice = Database['public']['Tables']['supplier_invoices']['Insert'];
type UpdateSupplierInvoice = Database['public']['Tables']['supplier_invoices']['Update'];

export const usePurchaseInvoices = () => {
  const queryClient = useQueryClient();

  const fetchPurchaseInvoices = async (): Promise<SupplierInvoiceWithDetails[]> => {
    try {
      // Intento 1: Fetch optimizado con JOIN (requiere Foreign Key)
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select(`
          *,
          supplier:supplier_id (
            id,
            name,
            rut
          )
        `)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      return data as SupplierInvoiceWithDetails[];
    } catch (error: any) {
      console.warn('Fallo fetch con JOIN, intentando fetch manual:', error.message);

      // Intento 2: Fetch manual sin JOIN (si falta FK en base de datos)
      // 1. Obtener facturas
      const { data: invoices, error: invoicesError } = await supabase
        .from('supplier_invoices')
        .select('*')
        .order('issue_date', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching purchase invoices (fallback):', invoicesError);
        throw invoicesError;
      }

      if (!invoices || invoices.length === 0) return [];

      // 2. Obtener proveedores relacionados
      const supplierIds = Array.from(new Set(invoices.map(inv => inv.supplier_id).filter(Boolean)));
      
      if (supplierIds.length === 0) {
        return invoices.map(inv => ({ ...inv, supplier: null })) as SupplierInvoiceWithDetails[];
      }

      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, rut')
        .in('id', supplierIds);

      if (suppliersError) {
        console.error('Error fetching suppliers for manual join:', suppliersError);
        // Retornar facturas sin proveedor si falla fetch de proveedores
        return invoices.map(inv => ({ ...inv, supplier: null })) as SupplierInvoiceWithDetails[];
      }

      // 3. Unir en memoria
      const supplierMap = new Map(suppliers?.map(s => [s.id, s]));
      
      return invoices.map(inv => ({
        ...inv,
        supplier: inv.supplier_id ? supplierMap.get(inv.supplier_id) || null : null
      })) as unknown as SupplierInvoiceWithDetails[];
    }
  };

  const {
    data: invoices = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['purchase-invoices'],
    queryFn: fetchPurchaseInvoices,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: CreateSupplierInvoice) => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Factura de compra creada exitosamente');
    },
    onError: (error) => {
      console.error('Error creating purchase invoice:', error);
      toast.error('Error al crear la factura de compra');
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSupplierInvoice }) => {
      const { data: result, error } = await supabase
        .from('supplier_invoices')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Factura de compra actualizada exitosamente');
    },
    onError: (error) => {
      console.error('Error updating purchase invoice:', error);
      toast.error('Error al actualizar la factura de compra');
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Factura de compra eliminada exitosamente');
    },
    onError: (error) => {
      console.error('Error deleting purchase invoice:', error);
      toast.error('Error al eliminar la factura de compra');
    },
  });

  return {
    invoices,
    isLoading,
    error,
    createInvoice: createInvoiceMutation.mutateAsync,
    updateInvoice: updateInvoiceMutation.mutateAsync,
    deleteInvoice: deleteInvoiceMutation.mutateAsync,
    isCreating: createInvoiceMutation.isPending,
    isUpdating: updateInvoiceMutation.isPending,
    isDeleting: deleteInvoiceMutation.isPending,
  };
};

export const usePurchaseInvoiceItems = () => {
  return useQuery({
    queryKey: ['purchase-invoice-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          reference_document,
          supplier_id,
          item:inventory_items (
            name,
            sku,
            barcode
          )
        `)
        .eq('movement_type', 'entry')
        .not('reference_document', 'is', null);

      if (error) {
        console.error('Error fetching purchase invoice items:', error);
        throw error;
      }
      
      // Group by supplier_id + reference_document
      const itemMap: Record<string, string[]> = {};
      
      data.forEach((m) => {
        const referenceDoc = m.reference_document;
        // Check if item exists and has properties
        const item = m.item && typeof m.item === 'object' ? (m.item as { name: string, sku?: string, barcode?: string }) : null;
        const itemName = item?.name;

        if (referenceDoc && itemName) {
          // Normalize key: supplier_id (if exists) + invoice_number
          // We normalize reference document to handle potential whitespace/case issues
          const normalizedRef = referenceDoc.trim().toUpperCase();
          
          const key = m.supplier_id 
            ? `${m.supplier_id}-${normalizedRef}`
            : normalizedRef; // Fallback
            
          // Create a composite search string containing name, SKU and barcode
          const searchString = [
            itemName,
            item?.sku,
            item?.barcode
          ].filter(Boolean).join(' ');

          if (!itemMap[key]) {
            itemMap[key] = [];
          }
          // Avoid duplicates
          if (!itemMap[key].includes(searchString)) {
            itemMap[key].push(searchString);
          }
          
          // Also store by reference only as a fallback lookup
          // This helps if supplier_id is missing in one of the records
          if (m.supplier_id) {
             if (!itemMap[normalizedRef]) {
                itemMap[normalizedRef] = [];
             }
             if (!itemMap[normalizedRef].includes(searchString)) {
                itemMap[normalizedRef].push(searchString);
             }
          }
        }
      });
      
      return itemMap;
    }
  });
};
