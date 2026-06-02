import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaymentFormData, SupplierPayment, SupplierPaymentStatus } from '@/types/suppliers';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';

import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useSupplierPayments");
const SUPPLIER_PAYMENTS_SELECT = `
  id,
  supplier_id,
  supplier_invoice_id,
  amount,
  category,
  subcategory,
  description,
  reference_number,
  notes,
  status,
  due_date,
  paid_date,
  paid_amount,
  part_name,
  part_quantity,
  part_unit_price,
  crane_id,
  add_to_inventory,
  cost_id,
  created_at,
  created_by,
  updated_at,
  updated_by
`;

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
    pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
    paid: 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30',
    overdue: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    cancelled: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30'
  };
  return colors[status] || colors.pending;
};

export const useSupplierPayments = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();

  async function createPartCostAndInventory({
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
      crane_id: string | null;
      add_to_inventory: boolean;
    };
  }) {
    let supplierName = 'Proveedor';
    if (paymentData.supplier_id) {
      const { data: supplierData } = await supabase
        .from('inventory_suppliers')
        .select('name')
        .eq('id', paymentData.supplier_id)
        .single();

      if (supplierData) {
        supplierName = supplierData.name;
      }
    }

    const { data: maintenanceCategory } = await supabase
      .from('cost_categories')
      .select('id')
      .eq('name', 'Mantenimiento')
      .single();

    if (!maintenanceCategory) {
      throw new Error('Categoría de Mantenimiento no encontrada');
    }

    const totalAmount = partDetails.part_quantity * partDetails.part_unit_price;

    const { data: paymentWithCost } = await supabase
      .from('supplier_payments')
      .select('cost_id')
      .eq('id', paymentId)
      .single();

    let costId: string;

    if (paymentWithCost?.cost_id) {
      const { data: updatedCost, error: updateError } = await supabase
        .from('costs')
        .update({
          amount: totalAmount,
          category_id: maintenanceCategory.id,
          crane_id: partDetails.crane_id,
          description: `Compra de piezas: ${partDetails.part_name}`,
          notes: `Pago a proveedor. Cantidad: ${partDetails.part_quantity}, Precio unitario: $${partDetails.part_unit_price}`,
          subcategory: paymentData.subcategory || 'Piezas y Repuestos',
          payment_date: paymentData.paid_date || getTodayLocal(),
        })
        .eq('id', paymentWithCost.cost_id)
        .select('id')
        .single();

      if (updateError) throw updateError;
      costId = updatedCost.id;

      await supabase
        .from('costs')
        .update({ supplier_payment_id: paymentId })
        .eq('id', costId)
        .is('supplier_payment_id', null);
    } else {
      const { data: costData, error: costError } = await supabase
        .from('costs')
        .insert({
          amount: totalAmount,
          category_id: maintenanceCategory.id,
          crane_id: partDetails.crane_id,
          date: paymentData.paid_date || getTodayLocal(),
          description: `Compra de piezas: ${partDetails.part_name}`,
          notes: `Pago a proveedor. Cantidad: ${partDetails.part_quantity}, Precio unitario: $${partDetails.part_unit_price}`,
          subcategory: paymentData.subcategory || 'Piezas y Repuestos',
          supplier_payment_id: paymentId,
          supplier_id: paymentData.supplier_id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select('id')
        .single();

      if (costError) throw costError;
      costId = costData.id;

      await supabase
        .from('supplier_payments')
        .update({ cost_id: costId })
        .eq('id', paymentId)
        .is('cost_id', null);
    }

    if (partDetails.add_to_inventory) {
      const { data: existingItem } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('name', partDetails.part_name)
        .single();

      let itemId = existingItem?.id;

      if (!itemId) {
        const { generateAutoSku } = await import('@/utils/skuGenerator');
        const { data: newItem, error: itemError } = await supabase
          .from('inventory_items')
          .insert({
            name: partDetails.part_name,
            unit_of_measure: 'unidad',
            unit_cost: partDetails.part_unit_price,
            sku: generateAutoSku(),
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select('id')
          .single();

        if (itemError) throw itemError;
        itemId = newItem.id;
      }

      const { data: defaultLocation } = await supabase
        .from('inventory_locations')
        .select('id')
        .eq('name', 'Bodega Principal')
        .single();

      if (!defaultLocation) {
        throw new Error('Ubicación de bodega no encontrada');
      }

      const movementPayload = {
        item_id: itemId,
        location_id: defaultLocation.id,
        movement_type: 'entry' as const,
        quantity: partDetails.part_quantity,
        unit_cost: partDetails.part_unit_price,
        total_cost: totalAmount,
        crane_id: null,
        supplier_id: paymentData.supplier_id,
        supplier_name: supplierName,
        cost_id: costId,
        movement_date: paymentData.paid_date || getTodayLocal(),
        reason: 'Compra desde módulo de proveedores',
        observations: `Pago: ${paymentData.reference_number || paymentData.description}`,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      await supabase
        .from('inventory_items')
        .update({ unit_cost: partDetails.part_unit_price })
        .eq('id', itemId)
        .or('unit_cost.is.null,unit_cost.lte.0');

      const { data: existingEntry } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('cost_id', costId)
        .eq('movement_type', 'entry')
        .eq('status', 'active')
        .maybeSingle();

      let entryId: string | null = existingEntry?.id || null;

      if (existingEntry?.id) {
        const { error: updateExistingError } = await supabase
          .from('inventory_movements')
          .update(movementPayload)
          .eq('id', existingEntry.id);

        if (updateExistingError) throw updateExistingError;
      } else {
        const { data: createdEntry, error: movementError } = await supabase
          .from('inventory_movements')
          .insert({
            ...movementPayload,
            status: 'active'
          })
          .select('id')
          .single();

        if (movementError) {
          const supabaseError = movementError as any;
          if (
            supabaseError?.code === '23505' &&
            typeof supabaseError?.message === 'string' &&
            supabaseError.message.includes('uniq_inventory_entry_active_per_cost')
          ) {
            const { data: alreadyCreated } = await supabase
              .from('inventory_movements')
              .select('id')
              .eq('cost_id', costId)
              .eq('movement_type', 'entry')
              .eq('status', 'active')
              .maybeSingle();

            if (alreadyCreated?.id) entryId = alreadyCreated.id;
            if (!entryId) {
              throw new Error('No se pudo recuperar el movimiento de entrada existente para este costo');
            }
            // Continuar el flujo (por ejemplo, consumo inmediato) usando entryId existente
            // No retornar aquí.
          }

          throw movementError;
        }

        if (createdEntry?.id) entryId = createdEntry.id;
      }

      if (!entryId) return;

      const shouldImmediateConsume = !!partDetails.crane_id;

      if (shouldImmediateConsume) {
        const exitPayload = {
          item_id: itemId,
          location_id: defaultLocation.id,
          movement_type: 'exit' as const,
          quantity: partDetails.part_quantity,
          unit_cost: partDetails.part_unit_price,
          total_cost: totalAmount,
          crane_id: partDetails.crane_id,
          supplier_id: paymentData.supplier_id,
          supplier_name: supplierName,
          cost_id: costId,
          movement_date: paymentData.paid_date || getTodayLocal(),
          reason: 'Consumo inmediato',
          observations: `Consumo inmediato desde proveedor. Pago: ${paymentData.reference_number || paymentData.description}`,
          created_by: (await supabase.auth.getUser()).data.user?.id
        };

        const { data: existingExit } = await supabase
          .from('inventory_movements')
          .select('id')
          .eq('cost_id', costId)
          .eq('movement_type', 'exit')
          .eq('status', 'active')
          .eq('crane_id', partDetails.crane_id)
          .maybeSingle();

        let exitId: string | null = existingExit?.id || null;

        if (existingExit?.id) {
          const { error: updateExitError } = await supabase
            .from('inventory_movements')
            .update(exitPayload)
            .eq('id', existingExit.id);

          if (updateExitError) throw updateExitError;
        } else {
          const { data: createdExit, error: createExitError } = await supabase
            .from('inventory_movements')
            .insert({
              ...exitPayload,
              status: 'active'
            })
            .select('id')
            .single();

          if (createExitError) throw createExitError;
          exitId = createdExit?.id || null;
        }

        if (exitId) {
          await supabase
            .from('costs')
            .update({ inventory_movement_id: exitId })
            .eq('id', costId);
        }
      } else {
        await supabase
          .from('costs')
          .update({ inventory_movement_id: entryId })
          .eq('id', costId);
      }
    }
  }

  const paymentsQuery = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: async (): Promise<SupplierPayment[]> => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .select(SUPPLIER_PAYMENTS_SELECT)
        .order('due_date', { ascending: false });

      if (error) throw error;
      return (data || []) as SupplierPayment[];
    }
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData): Promise<SupplierPayment> => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      const isPaid = data.status === 'paid';
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
          paid_amount: isPaid ? data.amount : 0,
          paid_date: isPaid ? (data.paid_date || getTodayLocal()) : null,
          part_name: data.part_name || null,
          part_quantity: data.part_quantity || null,
          part_unit_price: data.part_unit_price || null,
          crane_id: data.crane_id || null,
          add_to_inventory: data.add_to_inventory || false,
          supplier_invoice_id: data.supplier_invoice_id || null,
          created_by: userId
        } as any)
        .select(SUPPLIER_PAYMENTS_SELECT)
        .single();

      if (error) throw error;

      if (
        isPaid &&
        payment &&
        data.part_name &&
        (data.add_to_inventory || !!data.crane_id)
      ) {
        await createPartCostAndInventory({
          paymentId: (payment as any).id,
          paymentData: payment as SupplierPayment,
          partDetails: {
            part_name: data.part_name,
            part_quantity: data.part_quantity || 1,
            part_unit_price: data.part_unit_price || 0,
            crane_id: data.crane_id || null,
            add_to_inventory: data.add_to_inventory || false
          }
        });
      }

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
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices-pending'] });
      toast.success('Pago creado exitosamente');
    },
    onError: (error) => {
      logger.error('Error creating payment:', error);
      toast.error('Error al crear el pago');
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentFormData> }): Promise<SupplierPayment> => {
      // Explicitly map only valid DB columns to avoid sending non-DB fields
      const cleanedData: Record<string, any> = {
        supplier_id: data.supplier_id,
        amount: data.amount,
        due_date: data.due_date,
        description: data.description,
        category: data.category === "" ? null : (data.category || null),
        subcategory: data.subcategory || null,
        reference_number: data.reference_number || null,
        notes: data.notes || null,
        status: data.status || 'pending',
        crane_id: data.crane_id === "" ? null : (data.crane_id || null),
        part_name: data.part_name === "" ? null : (data.part_name || null),
        part_quantity: data.part_quantity,
        part_unit_price: data.part_unit_price,
        add_to_inventory: data.add_to_inventory,
        supplier_invoice_id: data.supplier_invoice_id || null,
      };

      if (!('part_name' in data)) delete cleanedData.part_name;
      if (!('part_quantity' in data)) delete cleanedData.part_quantity;
      if (!('part_unit_price' in data)) delete cleanedData.part_unit_price;
      if (!('add_to_inventory' in data)) delete cleanedData.add_to_inventory;
      
      // Si se está marcando como paid, sincronizar paid_amount con amount total
      if (data.status === 'paid') {
        cleanedData.paid_date = data.paid_date || getTodayLocal();
        // Siempre igualar paid_amount al monto total cuando se marca como pagado
        cleanedData.paid_amount = typeof data.amount === 'number' ? data.amount : 0;
      }
      
      const { data: payment, error } = await supabase
        .from('supplier_payments')
        .update(cleanedData)
        .eq('id', id)
        .select(SUPPLIER_PAYMENTS_SELECT)
        .single();

      if (error) throw error;

      const typedPayment = payment as SupplierPayment;

      // Si se está marcando como paid y tiene detalles de productos, ejecutar lógica adicional
      if (data.status === 'paid' && payment && data.part_name && (data.add_to_inventory || !!data.crane_id)) {
        await createPartCostAndInventory({
          paymentId: id,
          paymentData: typedPayment,
          partDetails: {
            part_name: data.part_name,
            part_quantity: data.part_quantity || 1,
            part_unit_price: data.part_unit_price || 0,
            crane_id: data.crane_id || null,
            add_to_inventory: data.add_to_inventory || false
          }
        });
      }

      return typedPayment;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Pago actualizado exitosamente');
    },
    onError: (error) => {
      logger.error('Error updating payment:', error);
      toast.error('Error al actualizar el pago');
    }
  });

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
          paid_date: paid_date || getTodayLocal(),
          paid_amount
        })
        .eq('id', id)
        .select(SUPPLIER_PAYMENTS_SELECT)
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
            crane_id: partDetails.crane_id || null,
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
      invalidateAll();
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
      logger.error('Error marking payment as paid:', error);
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
      invalidateAll();
      toast.success('Pago eliminado exitosamente');
    },
    onError: (error) => {
      logger.error('Error deleting payment:', error);
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
      logger.error('Error updating overdue payments:', error);
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
