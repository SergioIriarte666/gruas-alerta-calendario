
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { Cost, CostFormData, PartsExpenseData } from '@/types/costs';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';

const fetchCosts = async (): Promise<Cost[]> => {
  const { data, error } = await supabase
    .from('costs')
    .select(`
      *,
      cost_categories (*),
      cost_centers (*),
      cranes (*),
      operators (*),
      services (*, clients!services_client_id_fkey(*)),
      crane_parts (
        part_name,
        supplier,
        phone,
        quantity,
        unit_price,
        total_value,
        kilometraje
      ),
      crane_maintenance (
        id,
        description,
        maintenance_type,
        provider,
        notes
      ),
      creator:profiles!costs_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .order('payment_date', { ascending: false, nullsFirst: false })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching costs:', error);
    throw new Error(error.message);
  }

  return (data as any) || [];
};

export const useCosts = () => {
  return useQuery({
    queryKey: ['costs'],
    queryFn: fetchCosts,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
  });
};

export const usePagedCosts = (page: number, pageSize: number) => {
  return useQuery({
    queryKey: ['costs', 'paged', page, pageSize],
    queryFn: async (): Promise<{ costs: Cost[]; total: number }> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('costs')
        .select(
          `
          *,
          cost_categories (*),
          cost_centers (*),
          cranes (*),
          operators (*),
          services (*, clients!services_client_id_fkey(*)),
          crane_parts (
            part_name,
            supplier,
            phone,
            quantity,
            unit_price,
            total_value,
            kilometraje
          ),
          crane_maintenance (
            id,
            description,
            maintenance_type,
            provider,
            notes
          ),
          creator:profiles!costs_created_by_fkey (
            id,
            full_name,
            email
          )
        `,
          { count: 'exact' }
        )
        .order('payment_date', { ascending: false, nullsFirst: false })
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching paged costs:', error);
        throw new Error(error.message);
      }

      const total = typeof count === 'number' ? count : (data as any[])?.length || 0;

      return {
        costs: ((data as any) || []) as Cost[],
        total,
      };
    },
    enabled: page > 0 && pageSize > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

const addCost = async (costData: CostFormData) => {
  console.log('[useCosts - addCost] Attempting to create cost with data:', costData);
  
  try {
    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser();
    
    // VALIDACIÓN ROBUSTA DE DATOS REQUERIDOS
    if (!costData.category_id) {
      throw new Error('La categoría es requerida');
    }
    
    if (!costData.description || costData.description.trim() === '') {
      throw new Error('La descripción es requerida');
    }
    
    if (!costData.date) {
      throw new Error('La fecha es requerida');
    }
    
    // Asegurar que amount sea un número válido
    const validAmount = typeof costData.amount === 'number' 
      ? costData.amount 
      : parseFloat(String(costData.amount)) || 0;
    
    if (validAmount < 0) {
      throw new Error('El monto no puede ser negativo');
    }
    
    // Preparar datos específicos para la tabla costs (filtrar campos de crane_parts)
    const validCostFields = {
      amount: validAmount,
      category_id: costData.category_id,
      crane_id: costData.crane_id,
      operator_id: costData.operator_id,
      service_id: costData.service_id,
      date: costData.date,
      description: costData.description.trim(),
      notes: costData.notes,
      subcategory: costData.subcategory,
      service_folio: costData.service_folio,
      cost_center_id: costData.cost_center_id,
      // FASE 2: Campos para sincronización con inventario
      purchase_quantity: costData.purchase_quantity,
      purchase_unit_cost: costData.purchase_unit_cost,
      immediate_consumption: costData.immediate_consumption || false,
      created_by: user?.id || null,
      // FASE 3: Campos para sincronización con proveedores
      supplier_id: costData.supplier_id || null,
      payment_date: costData.payment_date || null,
    };
    
    console.log('[useCosts - addCost] Validated cost data (only costs fields):', validCostFields);
    
    // Verificar si es un costo de piezas y repuestos para sincronización
    const isPartsExpense = costData.subcategory === 'Piezas y Repuestos';
    
    // Crear el costo SOLO con campos válidos de la tabla costs
    const { data: costResult, error: costError } = await supabase
      .from('costs')
      .insert([validCostFields])
      .select();

    if (costError) {
      console.error('[useCosts - addCost] Database error:', costError);
      console.error('[useCosts - addCost] Error code:', costError.code);
      console.error('[useCosts - addCost] Error details:', costError.details);
      throw new Error(`Error de base de datos: ${costError.message}`);
    }
    
    if (!costResult || costResult.length === 0) {
      console.error('[useCosts - addCost] No data returned from insert');
      throw new Error('No se pudo crear el costo - sin datos devueltos');
    }

  const createdCost = costResult[0];
  console.log('[useCosts - addCost] Cost created successfully:', createdCost);

    // Si es un costo de piezas y repuestos, crear también el registro en crane_parts
    if (isPartsExpense && costData.crane_id) {
      const partsData = costData;
      
      if (partsData.part_name && partsData.supplier && partsData.quantity && partsData.unit_price) {
        // VALIDACIÓN ESPECÍFICA PARA PIEZAS
        if (!partsData.quantity || partsData.quantity <= 0) {
          throw new Error('La cantidad de piezas debe ser mayor a 0');
        }
        
        if (!partsData.unit_price || partsData.unit_price <= 0) {
          throw new Error('El precio unitario debe ser mayor a 0');
        }
        
        const cranePartData = {
          crane_id: costData.crane_id,
          cost_id: createdCost.id, // Ya asociamos con el costo creado
          part_name: partsData.part_name.trim(),
          supplier: partsData.supplier.trim(),
          phone: partsData.supplier_phone || null,
          quantity: partsData.quantity,
          unit_price: partsData.unit_price,
          date: costData.date,
          notes: costData.notes || null,
          kilometraje: partsData.kilometraje || null,
          created_by: null // No trigger automático porque ya tenemos cost_id
        };

        console.log('[useCosts - addCost] Inserting crane_parts with data:', cranePartData);

        const { error: partsError } = await supabase
          .from('crane_parts')
          .insert([cranePartData]);

        if (partsError) {
          console.error('[useCosts - addCost] Error creating crane part:', partsError);
          console.error('[useCosts - addCost] Parts error code:', partsError.code);
          console.error('[useCosts - addCost] Parts error details:', partsError.details);
          
          // Eliminar el costo creado si hay error en las piezas
          await supabase.from('costs').delete().eq('id', createdCost.id);
          throw new Error(`Error al registrar las piezas: ${partsError.message}`);
        } else {
          console.log('[useCosts - addCost] Crane part created successfully');
        }
      }
    }

    return costResult;
  } catch (error) {
    console.error('[useCosts - addCost] Unexpected error:', error);
    throw error;
  }
};

export const useAddCost = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();
  
  return useMutation({
    mutationFn: addCost,
    onSuccess: (data, variables) => {
      console.log('[useAddCost] Mutation success with data:', data);
      invalidateAll();
      toast.success('Costo registrado correctamente');
      
      if (data?.[0]?.service_id) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', data[0].service_id] });
      }

      // Retornar información para triggear el diálogo de distribución si es necesario
      return {
        cost: data[0],
        shouldShowDistribution: variables.immediate_consumption && 
                                variables.purchase_quantity && 
                                variables.purchase_quantity > 0
      };
    },
    onError: createMutationErrorHandler({
      title: 'Error al Crear Costo',
      context: 'useAddCost'
    }),
  });
};

const updateCost = async ({ id, ...costData }: { id: string } & any) => {
  console.log('[useCosts - updateCost] Attempting to update cost:', id, costData);
  
  // Separar campos de costs y campos de crane_parts
  const { part_name, supplier, supplier_phone, quantity, unit_price, kilometraje, ...validCostData } = costData;
  
  // Actualizar el costo
  const { data, error } = await supabase
    .from('costs')
    .update(validCostData)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`[useCosts - updateCost] Supabase error for ID ${id}:`, error);
    throw new Error(error.message);
  }
  
  if (!data || data.length === 0) {
    console.error('[useCosts - updateCost] No data returned from update');
    throw new Error('No se pudo actualizar el costo - sin datos devueltos');
  }

  // Si es una pieza y repuesto, sincronizar con crane_parts
  if (validCostData.subcategory === 'Piezas y Repuestos' && part_name && supplier && quantity && unit_price) {
    const total_value = quantity * unit_price;
    
    // Verificar si ya existe una pieza asociada a este costo
    const { data: existingPart } = await supabase
      .from('crane_parts')
      .select('id')
      .eq('cost_id', id)
      .single();

    if (existingPart) {
      // Actualizar pieza existente
      await supabase
        .from('crane_parts')
        .update({
          part_name,
          supplier,
          phone: supplier_phone,
          quantity,
          unit_price,
          // total_value se calcula automáticamente por la BD
          date: validCostData.date || data[0].date,
          crane_id: validCostData.crane_id || data[0].crane_id,
          kilometraje,
          notes: validCostData.notes
        })
        .eq('cost_id', id);
    } else {
      // Crear nueva pieza
      await supabase
        .from('crane_parts')
        .insert({
          cost_id: id,
          part_name,
          supplier,
          phone: supplier_phone,
          quantity,
          unit_price,
          // total_value se calcula automáticamente por la BD
          date: validCostData.date || data[0].date,
          crane_id: validCostData.crane_id || data[0].crane_id,
          kilometraje,
          notes: validCostData.notes
        });
    }
  }

  console.log('[useCosts - updateCost] Cost updated successfully:', data);
  return data;
};

export const useUpdateCost = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();  // FASE 5: Sincronización universal
  
  return useMutation({
    mutationFn: updateCost,
    onSuccess: (data) => {
      console.log('[useUpdateCost] Mutation success with data:', data);
      
      // FASE 5: Invalidar todas las queries relacionadas
      invalidateAll();
      
      if (data?.[0]?.service_id) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', data[0].service_id] });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Costo',
      context: 'useUpdateCost'
    }),
  });
};

const deleteCost = async (id: string) => {
  // First, get the cost data to obtain service_id for proper cache invalidation
  const { data: costData, error: fetchError } = await supabase
    .from('costs')
    .select('service_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching cost data before deletion:', fetchError);
  }

  const { error } = await supabase.from('costs').delete().eq('id', id);

  if (error) {
    console.error('Error deleting cost:', error);
    throw new Error(error.message);
  }

  // Return the service_id for cache invalidation
  return costData?.service_id;
};

// Link an XML invoice to an existing cost (instead of creating a new payment)
export const useLinkInvoiceToCost = () => {
  const queryClient = useQueryClient();
  const { invalidateAll } = useUniversalSync();

  return useMutation({
    mutationFn: async ({
      costId,
      supplierId,
      invoiceData,
    }: {
      costId: string;
      supplierId: string;
      invoiceData: {
        folio: string;
        issueDate: string;
        dueDate: string;
        amount: number;
        netAmount: number;
        taxAmount: number;
        description: string;
        currency?: string;
        paidDate?: string;
        status?: 'pending' | 'paid';
      };
    }) => {
      // 1. Create supplier_invoice
      const isPaid = invoiceData.status === 'paid';
      const { data: invoice, error: invoiceError } = await supabase
        .from('supplier_invoices')
        .insert({
          supplier_id: supplierId,
          invoice_number: invoiceData.folio,
          issue_date: invoiceData.issueDate,
          due_date: invoiceData.dueDate,
          amount: invoiceData.amount,
          net_amount: invoiceData.netAmount,
          tax_amount: invoiceData.taxAmount,
          description: invoiceData.description,
          currency: invoiceData.currency || 'CLP',
          status: isPaid ? 'paid' : 'pending',
          paid_amount: isPaid ? invoiceData.amount : 0,
          balance: isPaid ? 0 : invoiceData.amount,
        })
        .select()
        .single();

      if (invoiceError) throw new Error(`Error creando factura: ${invoiceError.message}`);

      // 2. Update cost notes and payment_date with invoice reference
      const costUpdate: Record<string, any> = {
        notes: `Factura ${invoiceData.folio} - ${invoiceData.description}`,
        updated_at: new Date().toISOString(),
      };
      if (isPaid && invoiceData.paidDate) {
        costUpdate.payment_date = invoiceData.paidDate;
      }
      const { error: costError } = await supabase
        .from('costs')
        .update(costUpdate)
        .eq('id', costId);

      if (costError) throw new Error(`Error actualizando costo: ${costError.message}`);

      // 3. Link invoice to existing supplier_payment if exists
      const { data: costData } = await supabase
        .from('costs')
        .select('supplier_payment_id')
        .eq('id', costId)
        .single();

      if (costData?.supplier_payment_id) {
        const paymentUpdate: Record<string, any> = {
          supplier_invoice_id: invoice.id,
          reference_number: invoiceData.folio,
        };
        if (isPaid && invoiceData.paidDate) {
          paymentUpdate.status = 'paid';
          paymentUpdate.paid_date = invoiceData.paidDate;
          paymentUpdate.paid_amount = invoiceData.amount;
        }
        await supabase
          .from('supplier_payments')
          .update(paymentUpdate)
          .eq('id', costData.supplier_payment_id);
      } else {
        // Also check via cost_id
        const { data: paymentByCostId } = await supabase
          .from('supplier_payments')
          .select('id')
          .eq('cost_id', costId)
          .maybeSingle();

        if (paymentByCostId) {
          await supabase
            .from('supplier_payments')
            .update({
              supplier_invoice_id: invoice.id,
              reference_number: invoiceData.folio,
            })
            .eq('id', paymentByCostId.id);
        }
      }

      return { invoiceId: invoice.id, costId };
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Factura vinculada al costo existente');
    },
    onError: (error: Error) => {
      console.error('Error linking invoice to cost:', error);
      toast.error(error.message);
    },
  });
};

export const useDeleteCost = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();
  
  return useMutation({
    mutationFn: deleteCost,
    onSuccess: (serviceId) => {
      console.log('[useDeleteCost] Cost deleted successfully, service_id:', serviceId);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.refetchQueries({ queryKey: ['reports'] });
      
      if (serviceId) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceId] });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Costo',
      context: 'useDeleteCost'
    }),
  });
};
