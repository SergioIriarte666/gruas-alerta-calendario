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
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: data.supplier_id,
          amount: data.amount,
          due_date: data.due_date,
          description: data.description,
          category: data.category || null,
          subcategory: data.subcategory || null,
          reference_number: data.reference_number || null,
          notes: data.notes || null,
          status: data.status || 'pending',
          part_name: data.part_name || null,
          part_quantity: data.part_quantity || null,
          part_unit_price: data.part_unit_price || null,
          crane_id: data.crane_id || null,
          add_to_inventory: data.add_to_inventory || false,
          supplier_invoice_id: data.supplier_invoice_id || null,
          created_by: userId
        } as any)
        .select()
        .single();

      if (error) throw error;

      // If there are selected invoices and payment is marked as paid, update invoice paid_amount
      if (data.selected_invoice_ids && data.selected_invoice_ids.length > 0 && data.status === 'paid') {
        for (const invoiceId of data.selected_invoice_ids) {
          // Get current invoice data
          const { data: invoice } = await supabase
            .from('supplier_invoices')
            .select('paid_amount, amount')
            .eq('id', invoiceId)
            .single();

          if (invoice) {
            // Calculate proportional payment for this invoice
            const invoiceBalance = invoice.amount - (invoice.paid_amount || 0);
            const paymentForInvoice = Math.min(invoiceBalance, data.amount);
            const newPaidAmount = (invoice.paid_amount || 0) + paymentForInvoice;
            const newStatus = newPaidAmount >= invoice.amount ? 'paid' : 'partial';

            await supabase
              .from('supplier_invoices')
              .update({
                paid_amount: newPaidAmount,
                status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', invoiceId);
          }
        }
      }

      return payment as SupplierPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices-pending'] });
      // Sync: trigger crea cost automáticamente
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      toast.success('Pago creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating payment:', error);
      toast.error('Error al crear el pago');
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentFormData> }): Promise<SupplierPayment> => {
      // Clean up empty strings for UUID fields
      const cleanedData = {
        ...data,
        crane_id: data.crane_id === "" ? null : data.crane_id,
        category: data.category === "" ? null : data.category,
      };
      
      // Si se está marcando como paid, agregar paid_date y paid_amount
      if (data.status === 'paid') {
        cleanedData.paid_date = cleanedData.paid_date || new Date().toISOString().split('T')[0];
        cleanedData.paid_amount = cleanedData.paid_amount || data.amount || 0;
      }
      
      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .update(cleanedData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const typedPayment = payment as SupplierPayment;

      // Si se está marcando como paid y tiene detalles de productos, ejecutar lógica adicional
      if (data.status === 'paid' && payment && data.part_name && data.crane_id) {
        await createPartCostAndInventory({
          paymentId: id,
          paymentData: typedPayment,
          partDetails: {
            part_name: data.part_name,
            part_quantity: data.part_quantity || 1,
            part_unit_price: data.part_unit_price || 0,
            crane_id: data.crane_id,
            add_to_inventory: data.add_to_inventory || false
          }
        });
      }

      return typedPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      // Sync: puede crear/actualizar costs y crane_parts
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success('Pago actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error updating payment:', error);
      toast.error('Error al actualizar el pago');
    }
  });

  // Función auxiliar para crear costos, crane_parts e inventory_movements
  const createPartCostAndInventory = async ({
    paymentId,
    paymentData,
    partDetails
  }: {
    paymentId: string;
    paymentData: SupplierPayment;
    partDetails: {
      part_name: string;
      part_quantity: number;
      part_unit_price: number;
      crane_id: string;
      add_to_inventory: boolean;
    }
  }) => {
    // Obtener nombre del proveedor
    let supplierName = 'Proveedor';
    if (paymentData.supplier_id) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', paymentData.supplier_id)
        .single();
      
      if (supplierData) {
        supplierName = supplierData.name;
      }
    }

    // Obtener categoría de Mantenimiento
    const { data: maintenanceCategory } = await supabase
      .from('cost_categories')
      .select('id')
      .eq('name', 'Mantenimiento')
      .single();

    if (!maintenanceCategory) {
      throw new Error('Categoría de Mantenimiento no encontrada');
    }

    const totalAmount = partDetails.part_quantity * partDetails.part_unit_price;

    // Buscar si el payment ya tiene un cost vinculado (via cost_id en el payment)
    const { data: paymentWithCost } = await supabase
      .from('supplier_payments')
      .select('cost_id')
      .eq('id', paymentId)
      .single();

    let costId: string;

    if (paymentWithCost?.cost_id) {
      // Ya existe un cost vinculado → actualizar en vez de crear
      const { data: updatedCost, error: updateError } = await supabase
        .from('costs')
        .update({
          amount: totalAmount,
          category_id: maintenanceCategory.id,
          crane_id: partDetails.crane_id,
          description: `Compra de piezas: ${partDetails.part_name}`,
          notes: `Pago a proveedor. Cantidad: ${partDetails.part_quantity}, Precio unitario: $${partDetails.part_unit_price}`,
          subcategory: paymentData.subcategory || 'Piezas y Repuestos',
          payment_date: paymentData.paid_date || new Date().toISOString().split('T')[0],
        })
        .eq('id', paymentWithCost.cost_id)
        .select()
        .single();

      if (updateError) throw updateError;
      costId = updatedCost.id;
    } else {
      // No existe cost → crear uno nuevo con supplier_payment_id para evitar trigger circular
      const { data: costData, error: costError } = await supabase
        .from('costs')
        .insert({
          amount: totalAmount,
          category_id: maintenanceCategory.id,
          crane_id: partDetails.crane_id,
          date: paymentData.paid_date || new Date().toISOString().split('T')[0],
          description: `Compra de piezas: ${partDetails.part_name}`,
          notes: `Pago a proveedor. Cantidad: ${partDetails.part_quantity}, Precio unitario: $${partDetails.part_unit_price}`,
          subcategory: paymentData.subcategory || 'Piezas y Repuestos',
          supplier_payment_id: paymentId,
          supplier_id: paymentData.supplier_id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (costError) throw costError;
      costId = costData.id;
    }

    // Si add_to_inventory es true, crear movimiento de inventario
    if (partDetails.add_to_inventory) {
      // Buscar o crear el item de inventario
      const { data: existingItem } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('name', partDetails.part_name)
        .single();

      let itemId = existingItem?.id;

      // Si no existe, crear el item
      if (!itemId) {
        const { data: newItem, error: itemError } = await supabase
          .from('inventory_items')
          .insert({
            name: partDetails.part_name,
            unit_of_measure: 'unidad',
            unit_cost: partDetails.part_unit_price,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();

        if (itemError) throw itemError;
        itemId = newItem.id;
      }

      // Obtener la ubicación por defecto (Bodega Principal)
      const { data: defaultLocation } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('name', 'Bodega Principal')
        .single();

      if (!defaultLocation) {
        throw new Error('Ubicación de bodega no encontrada');
      }

      // Crear movimiento de inventario
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          item_id: itemId,
          location_id: defaultLocation.id,
          movement_type: 'entry',
          quantity: partDetails.part_quantity,
          unit_cost: partDetails.part_unit_price,
          total_cost: totalAmount,
          crane_id: partDetails.crane_id,
          supplier_id: paymentData.supplier_id,
          cost_id: costId,
          movement_date: paymentData.paid_date || new Date().toISOString().split('T')[0],
          reason: 'Compra desde módulo de proveedores',
          observations: `Pago: ${paymentData.reference_number || paymentData.description}`,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (movementError) throw movementError;
    }

    // NOTA: La creación de crane_parts se maneja automáticamente por triggers
  };

  const markPaymentAsPaidMutation = useMutation({
    mutationFn: async ({ 
      id, 
      paid_amount,
      paid_date,
      partDetails 
    }: { 
      id: string; 
      paid_amount: number;
      paid_date?: string;
      partDetails?: {
        part_name: string;
        part_quantity: number;
        part_unit_price: number;
        crane_id: string;
        add_to_inventory?: boolean;
      }
    }) => {
      // Marcar el pago como pagado
      const { data: paymentData, error: paymentError } = await supabase
        .from('supplier_payments')
        .update({
          status: 'paid',
          paid_date: paid_date || new Date().toISOString().split('T')[0],
          paid_amount
        })
        .eq('id', id)
        .select()
        .single();

      if (paymentError) throw paymentError;

      const typedPaymentData = paymentData as SupplierPayment;

      // Si hay detalles de piezas, crear todo
      if (partDetails) {
        await createPartCostAndInventory({
          paymentId: id,
          paymentData: typedPaymentData,
          partDetails: {
            ...partDetails,
            add_to_inventory: partDetails.add_to_inventory || false
          }
        });
      }

      return typedPaymentData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      // Invalidar costos, grúas e inventario
      invalidateAllCostQueries();
      queryClient.invalidateQueries({ queryKey: ['crane-costs'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      
      const message = variables.partDetails 
        ? 'Pago marcado como pagado - Se registró automáticamente en costos, piezas e inventario'
        : 'Pago marcado como pagado - Se registrará automáticamente en costos';
      
      toast.success(message);
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
      // Sync: trigger desvincula cost, invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
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