import { businessClock } from '@/utils/businessClock';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { Cost, CostFormData } from '@/types/costs';
import { EntityKey } from '@/lib/entities';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCosts");
const _COSTS_SELECT_CLAUSE = `
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
      ),
      supplier_invoices!costs_supplier_invoice_id_fkey (
        id,
        supplier_invoice_items (id)
      )
    `;

const COSTS_LIST_SELECT_CLAUSE = `
  id,
  created_at,
  updated_at,
  date,
  description,
  amount,
  subcategory,
  category_id,
  operator_id,
  crane_id,
  service_id,
  service_folio,
  cost_center_id,
  document_type,
  document_number,
  payment_date,
  entity,
  paid_by,
  dte_tipo,
  dte_folio,
  dte_rut_emisor,
  notes,
  supplier_id,
  supplier_invoice_id,
  supplier_payment_id,
  inventory_movement_id,
  cost_categories (id, name),
  cost_centers (id, name),
  creator:profiles!costs_created_by_fkey (
    id,
    full_name,
    email
  ),
  cranes (id, brand, model, license_plate),
  operators (id, name),
  services (id, folio),
  inventory_suppliers!costs_supplier_id_fkey (id, name, rut, address, phone, email),
  supplier_invoices!costs_supplier_invoice_id_fkey (
    id,
    invoice_number,
    supplier_invoice_items (
      id,
      line_number,
      product_name,
      description,
      quantity,
      unit_price,
      subtotal,
      tax_amount,
      total_amount
    )
  )
`;

export interface CostDateFilters {
  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string;   // 'YYYY-MM-DD'
  /** Filtra por entidad legal dueña del gasto. Sin este filtro se traen ambas entidades. */
  entity?: EntityKey;
}

export interface CostQueryFilters extends CostDateFilters {
  searchTerm?: string;
}

const fetchCosts = async (filters: CostDateFilters = {}): Promise<Cost[]> => {
  const PAGE_SIZE = 1000;
  const allCosts: Cost[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('costs')
      .select(COSTS_LIST_SELECT_CLAUSE)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('date', filters.dateTo);
    if (filters.entity) query = query.eq('entity', filters.entity);

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching costs (page ' + page + '):', error);
      throw new Error(error.message);
    }

    const rows = (data as any[]) || [];
    allCosts.push(...(rows as Cost[]));

    if (rows.length < PAGE_SIZE) break;
    page++;
  }

  return allCosts;
};

export const useCosts = (filters: CostDateFilters = {}) => {
  // Normalizar '' a undefined para que todos los consumidores sin filtro compartan cache
  const dateFrom = filters.dateFrom || undefined;
  const dateTo = filters.dateTo || undefined;
  const entity = filters.entity || undefined;

  return useQuery({
    // Las fechas DEBEN ir en la queryKey: sin esto TanStack Query reutiliza
    // el cache de la query sin filtros y el filtro nunca re-fetcha
    queryKey: ['costs', { dateFrom, dateTo, entity }],
    queryFn: () => fetchCosts({ dateFrom, dateTo, entity }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const usePagedCosts = (
  page: number,
  pageSize: number,
  filters: CostQueryFilters = {}
) => {
  const dateFrom = filters.dateFrom || undefined;
  const dateTo = filters.dateTo || undefined;
  const searchTerm = filters.searchTerm?.trim() || undefined;
  const entity = filters.entity || undefined;

  return useQuery({
    queryKey: ['costs', 'paged', page, pageSize, { dateFrom, dateTo, searchTerm: searchTerm ?? '', entity }],
    queryFn: async (): Promise<{ costs: Cost[]; total: number }> => {
      const hasSearch = !!searchTerm;
      const searchLower = searchTerm?.toLowerCase() ?? '';

      const from = hasSearch ? 0 : (page - 1) * pageSize;
      const to   = hasSearch ? 499 : from + pageSize - 1;

      let query = supabase
        .from('costs')
        .select(COSTS_LIST_SELECT_CLAUSE, { count: 'exact' })
        .order('payment_date', { ascending: false, nullsFirst: false })
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      if (entity) query = query.eq('entity', entity);

      if (hasSearch) {
        query = query.or(
          [
            `description.ilike.%${searchLower}%`,
            `notes.ilike.%${searchLower}%`,
            `subcategory.ilike.%${searchLower}%`,
            `service_folio.ilike.%${searchLower}%`,
          ].join(',')
        );
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching paged costs:', error);
        throw new Error(error.message);
      }

      const total = typeof count === 'number' ? count : (data as any[])?.length || 0;

      return {
        costs: ((data as any) || []) as Cost[],
        total,
      };
    },
    placeholderData: keepPreviousData,
    enabled: page > 0 && pageSize > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

const addCost = async (costData: CostFormData) => {
  logger.debug('[useCosts - addCost] Attempting to create cost with data:', costData);
  
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

    if (!costData.entity || !costData.paid_by) {
      throw new Error('La entidad y el financiador del costo son requeridos');
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
      document_type: (costData as any).document_type || null,
      document_number: (costData as any).document_number || null,
      location_text: (costData as any).location_text || null,
      other_reason: (costData as any).other_reason || null,
      entity: costData.entity,
      paid_by: costData.paid_by,
      dte_tipo: (costData as any).dte_tipo ?? null,
      dte_folio: (costData as any).dte_folio ?? null,
      dte_rut_emisor: (costData as any).dte_rut_emisor || null,
      // FASE 2: Campos para sincronización con inventario
      purchase_quantity: costData.purchase_quantity,
      purchase_unit_cost: costData.purchase_unit_cost,
      immediate_consumption: costData.immediate_consumption || false,
      created_by: user?.id || null,
      // FASE 3: Campos para sincronización con proveedores
      supplier_id: costData.supplier_id || null,
      payment_date: costData.payment_date || null,
    };
    
    // Verificar si es un costo de piezas y repuestos para sincronización
    const isPartsExpense = costData.subcategory === 'Piezas y Repuestos';
    
    // Crear el costo SOLO con campos válidos de la tabla costs
    const { data: costResult, error: costError } = await supabase
      .from('costs')
      .insert([validCostFields])
      .select();

    if (costError) {
      logger.error('[useCosts - addCost] Database error:', costError);
      logger.error('[useCosts - addCost] Error code:', costError.code);
      logger.error('[useCosts - addCost] Error details:', costError.details);
      throw new Error(`Error de base de datos: ${costError.message}`);
    }
    
    if (!costResult || costResult.length === 0) {
      logger.error('[useCosts - addCost] No data returned from insert');
      throw new Error('No se pudo crear el costo - sin datos devueltos');
    }

  const createdCost = costResult[0];

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

        logger.debug('[useCosts - addCost] Inserting crane_parts with data:', cranePartData);

        const { error: partsError } = await supabase
          .from('crane_parts')
          .insert([cranePartData]);

        if (partsError) {
          logger.error('[useCosts - addCost] Error creating crane part:', partsError);
          logger.error('[useCosts - addCost] Parts error code:', partsError.code);
          logger.error('[useCosts - addCost] Parts error details:', partsError.details);
          
          // Eliminar el costo creado si hay error en las piezas
          await supabase.from('costs').delete().eq('id', createdCost.id);
          throw new Error(`Error al registrar las piezas: ${partsError.message}`);
        } else {
          logger.debug('[useCosts - addCost] Crane part created successfully');
        }
      }
    }

    return costResult;
  } catch (error) {
    logger.error('[useCosts - addCost] Unexpected error:', error);
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
      logger.debug('[useAddCost] Mutation success with data:', data);
      if (variables.purchase_quantity) {
        invalidateAll('with-inventory');
      } else if (variables.supplier_id) {
        invalidateAll('with-suppliers');
      } else {
        invalidateAll('costs-only');
      }
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
  logger.debug('[useCosts - updateCost] Attempting to update cost:', id, costData);

  // Separar campos de costs y campos de crane_parts
  const { part_name: _part_name, supplier: _supplier, supplier_phone: _supplier_phone, quantity: _quantity, unit_price: _unit_price, kilometraje: _kilometraje, ...validCostData } = costData;

  // Actualizar el costo
  const { data, error } = await supabase
    .from('costs')
    .update(validCostData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error(`[useCosts - updateCost] Supabase error for ID ${id}:`, error);
    throw new Error(error.message);
  }

  if (!data) {
    logger.error('[useCosts - updateCost] No data returned from update');
    throw new Error('No se pudo actualizar el costo - sin datos devueltos');
  }

  // Propagar descripción y monto a supplier_invoice si está vinculada
  if (data.supplier_invoice_id && (validCostData.description !== undefined || validCostData.amount !== undefined)) {
    const invoiceUpdate: Record<string, any> = {};
    if (validCostData.description !== undefined) {
      invoiceUpdate.description = validCostData.description;
      invoiceUpdate.product_service_description = validCostData.description;
    }
    if (validCostData.amount !== undefined) {
      invoiceUpdate.amount = validCostData.amount;
    }
    const { error: invoiceError } = await supabase
      .from('supplier_invoices')
      .update(invoiceUpdate)
      .eq('id', data.supplier_invoice_id);
    if (invoiceError) {
      logger.warn('[useCosts - updateCost] Could not sync supplier_invoice:', invoiceError.message);
    } else {
      logger.debug('[useCosts - updateCost] supplier_invoice synced:', data.supplier_invoice_id);
    }
  }

  // Propagar descripción a supplier_payment si está vinculado
  if (data.supplier_payment_id && validCostData.description !== undefined) {
    const { error: paymentError } = await supabase
      .from('supplier_payments')
      .update({ description: validCostData.description })
      .eq('id', data.supplier_payment_id);
    if (paymentError) {
      logger.warn('[useCosts - updateCost] Could not sync supplier_payment description:', paymentError.message);
    }
  }

  // Propagar descripción a inventory_movement si está vinculado
  if (data.inventory_movement_id && validCostData.description !== undefined) {
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .update({ observations: validCostData.description })
      .eq('id', data.inventory_movement_id);
    if (movementError) {
      logger.warn('[useCosts - updateCost] Could not sync inventory_movement observations:', movementError.message);
    }
  }

  // Propagar cambios a crane_parts si el costo tiene registros vinculados
  const cranePartsUpdate: Record<string, any> = {};
  if (validCostData.description !== undefined) {
    cranePartsUpdate.part_name = validCostData.description;
  }
  if (validCostData.amount !== undefined && validCostData.purchase_quantity) {
    cranePartsUpdate.unit_price = validCostData.amount / validCostData.purchase_quantity;
  }
  if (validCostData.date !== undefined) {
    cranePartsUpdate.date = validCostData.date;
  }
  if (validCostData.supplier_id !== undefined) {
    cranePartsUpdate.supplier_id = validCostData.supplier_id;
  }

  if (Object.keys(cranePartsUpdate).length > 0) {
    const { error: cranePartsError } = await supabase
      .from('crane_parts')
      .update(cranePartsUpdate)
      .eq('cost_id', id);
    if (cranePartsError) {
      logger.warn('[useCosts - updateCost] Could not sync crane_parts by cost_id:', cranePartsError.message);
    } else {
      logger.debug('[useCosts - updateCost] crane_parts synced for cost_id:', id);
    }

    if (data.inventory_movement_id) {
      const { error: cranePartsByMovementError } = await supabase
        .from('crane_parts')
        .update(cranePartsUpdate)
        .eq('inventory_movement_id', data.inventory_movement_id);
      if (cranePartsByMovementError) {
        logger.warn('[useCosts - updateCost] Could not sync crane_parts by movement_id:', cranePartsByMovementError.message);
      }
    }
  }

  logger.debug('[useCosts - updateCost] Cost updated successfully:', data);
  return [data];
};

export const useUpdateCost = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();  // FASE 5: Sincronización universal
  
  return useMutation({
    mutationFn: updateCost,
    onSuccess: (data) => {
      logger.debug('[useUpdateCost] Mutation success with data:', data);

      const updatedRecord = Array.isArray(data) ? data[0] : data;

      if (updatedRecord?.inventory_movement_id) {
        invalidateAll('with-inventory');
      } else if (updatedRecord?.supplier_invoice_id || updatedRecord?.supplier_payment_id) {
        invalidateAll('with-suppliers');
      } else {
        invalidateAll('costs-only');
      }
      if (updatedRecord?.service_id) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', updatedRecord.service_id] });
      }

      const hasLinkedRecords =
        updatedRecord?.supplier_invoice_id ||
        updatedRecord?.supplier_payment_id ||
        updatedRecord?.inventory_movement_id;

      if (hasLinkedRecords) {
        const linked: string[] = [];
        if (updatedRecord?.supplier_invoice_id) linked.push('factura de proveedor');
        if (updatedRecord?.supplier_payment_id) linked.push('pago');
        if (updatedRecord?.inventory_movement_id) linked.push('bodega');
        if (updatedRecord?.crane_id || updatedRecord?.inventory_movement_id) linked.push('grúa');

        toast.info('Costo actualizado', {
          description: `Cambios propagados a: ${linked.join(', ')}.`,
        });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Actualizar Costo',
      context: 'useUpdateCost'
    }),
  });
};

/**
 * Origen del borrado. Viaja hasta cost_change_history.change_context: sin él,
 * un borrado intencional desde Finanzas y uno provocado por un bug del wizard
 * se ven exactamente igual en el historial.
 */
export type CostChangeContext = 'wizard' | 'costs_module' | 'import' | 'sql';

export const deleteCostRecord = async (
  id: string,
  context: CostChangeContext = 'costs_module'
) => {
  // Break the circular FK first. The database trigger owns cancellation and stock reversal.
  const { data: costData, error: fetchError } = await supabase
    .from('costs')
    .select('service_id, inventory_movement_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    logger.error('Error fetching cost data before deletion:', fetchError);
    throw fetchError;
  }

  if (costData.inventory_movement_id) {
    const { error: unlinkError } = await supabase
      .from('costs')
      .update({ inventory_movement_id: null })
      .eq('id', id);

    if (unlinkError) {
      logger.error('Error unlinking inventory movement before cost deletion:', unlinkError);
      throw unlinkError;
    }
  }

  // Vía RPC y no .delete() directo: la función sella el origen del cambio y
  // además falla si el borrado no afectó ninguna fila (RLS), en vez de
  // devolver el silencio que PostgREST reporta como éxito.
  const { error } = await supabase.rpc('delete_cost_with_context', {
    p_cost_id: id,
    p_context: context,
  });

  if (error) {
    logger.error('Error deleting cost:', error);
    throw error;
  }

  return costData?.service_id;
};

const deleteCosts = async (ids: string[]) => {
  const serviceIds = await Promise.all(ids.map(id => deleteCostRecord(id)));
  return serviceIds.filter((serviceId): serviceId is string => Boolean(serviceId));
};

// Link an XML invoice to an existing cost (instead of creating a new payment)
export const useLinkInvoiceToCost = () => {
  const _queryClient = useQueryClient();
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
        .insert([{
          supplier_id: supplierId,
          invoice_number: invoiceData.folio,
          issue_date: invoiceData.issueDate,
          due_date: invoiceData.dueDate,
          amount: invoiceData.amount,
          net_amount: invoiceData.netAmount,
          tax_amount: invoiceData.taxAmount,
          description: invoiceData.description,
          product_service_description: invoiceData.description,
          currency: invoiceData.currency || 'CLP',
          status: isPaid ? 'paid' : 'pending',
          paid_amount: isPaid ? invoiceData.amount : 0,
        }])

        .select()
        .single();

      if (invoiceError) throw new Error(`Error creando factura: ${invoiceError.message}`);

      // 2. Update cost with real invoice data
      const costUpdate: Record<string, any> = {
        amount: invoiceData.amount,
        description: invoiceData.description,
        service_folio: invoiceData.folio,
        notes: `Factura ${invoiceData.folio} - ${invoiceData.description}`,
        supplier_invoice_id: invoice.id,
        updated_at: businessClock.nowISO(),
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
          const paymentUpdate2: Record<string, any> = {
            supplier_invoice_id: invoice.id,
            reference_number: invoiceData.folio,
          };
          if (isPaid && invoiceData.paidDate) {
            paymentUpdate2.status = 'paid';
            paymentUpdate2.paid_date = invoiceData.paidDate;
            paymentUpdate2.paid_amount = invoiceData.amount;
          }
          await supabase
            .from('supplier_payments')
            .update(paymentUpdate2)
            .eq('id', paymentByCostId.id);
        }
      }

      return { invoiceId: invoice.id, costId };
    },
    onSuccess: () => {
      invalidateAll('with-suppliers');
      toast.success('Factura vinculada al costo existente');
    },
    onError: (error: Error) => {
      logger.error('Error linking invoice to cost:', error);
      toast.error(error.message);
    },
  });
};

export const useDeleteCost = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();
  
  return useMutation({
    // Acepta el id suelto (Finanzas) o {id, context} para que el llamador
    // declare desde qué pantalla se pidió el borrado.
    mutationFn: (input: string | { id: string; context: CostChangeContext }) =>
      typeof input === 'string'
        ? deleteCostRecord(input)
        : deleteCostRecord(input.id, input.context),
    onSuccess: (serviceId) => {
      logger.debug('[useDeleteCost] Cost deleted successfully, service_id:', serviceId);
      invalidateAll('full');
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.refetchQueries({ queryKey: ['reports'] });
      
      if (serviceId) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceId] });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Costo',
      context: 'useDeleteCost',
      showTechnicalDetails: true,
    }),
  });
};

export const useDeleteCosts = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { invalidateAll } = useUniversalSync();

  return useMutation({
    mutationFn: deleteCosts,
    onSuccess: (serviceIds) => {
      serviceIds.forEach((serviceId) => {
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceId] });
      });
    },
    onSettled: () => {
      // Promise.all may partially complete before one deletion fails; refresh every affected module.
      invalidateAll('full');
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.refetchQueries({ queryKey: ['reports'] });
    },
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Costos',
      context: 'useDeleteCosts',
      showTechnicalDetails: true,
    }),
  });
};
