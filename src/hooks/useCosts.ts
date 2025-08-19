
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost, CostFormData, PartsExpenseData } from '@/types/costs';
import { toast } from 'sonner';

const fetchCosts = async (): Promise<Cost[]> => {
  const { data, error } = await supabase
    .from('costs')
    .select(`
      *,
      cost_categories (*),
      cranes (*),
      operators (*),
      services (*, clients(*)),
      crane_parts (
        part_name,
        supplier,
        phone,
        quantity,
        unit_price,
        total_value,
        kilometraje
      )
    `)
    .order('date', { ascending: false });

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
    staleTime: 0, // Always fresh data for reports
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

const addCost = async (costData: CostFormData) => {
  console.log('[useCosts - addCost] Attempting to create cost with data:', costData);
  
  try {
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
  return useMutation({
    mutationFn: addCost,
    onSuccess: (data) => {
      console.log('[useAddCost] Mutation success with data:', data);
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts-stats'] });
      // Invalidate reports queries to update metrics
      queryClient.refetchQueries({ queryKey: ['reports'] });
      
      // AGREGAR ESTAS LÍNEAS EN CADA onSuccess:
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      
      // Y SI HAY service_id:
      if (data?.[0]?.service_id) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', data[0].service_id] });
      }
    },
    onError: (error) => {
      console.error('[useAddCost] Mutation error:', error);
    }
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
  return useMutation({
    mutationFn: updateCost,
    onSuccess: (data) => {
      console.log('[useUpdateCost] Mutation success with data:', data);
      // Forzar refetch inmediato de costs para actualizar la vista
      queryClient.refetchQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
      queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
      queryClient.refetchQueries({ queryKey: ['reports'] });
      
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      
      if (data?.[0]?.service_id) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', data[0].service_id] });
      }
    },
    onError: (error) => {
      console.error('[useUpdateCost] Mutation error:', error);
    }
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

export const useDeleteCost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCost,
    onSuccess: (serviceId) => {
      console.log('[useDeleteCost] Cost deleted successfully, service_id:', serviceId);
      
      // Invalidate general queries
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.refetchQueries({ queryKey: ['reports'] });
      
      // Invalidate service-related queries
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      
      // If the deleted cost was associated with a service, invalidate that specific service's costs
      if (serviceId) {
        console.log('[useDeleteCost] Invalidating service-costs for service:', serviceId);
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceId] });
      }
    },
    onError: (error) => {
      console.error('[useDeleteCost] Mutation error:', error);
    }
  });
};
