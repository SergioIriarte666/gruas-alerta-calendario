import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { Cost, CostFormData, PartsExpenseData } from '@/types/costs';
import { toast } from 'sonner';
import { useUniversalSync } from './useUniversalSync';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { offlineFetch, offlineCreate, offlineUpdate, offlineDelete, generateTempId, markAsOffline } from '@/services/offlineOperations';

const fetchCosts = async (): Promise<Cost[]> => {
  const { data, error } = await supabase
    .from('costs')
    .select(`
      *,
      cost_categories (*),
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

// Función para hidratar costos con datos de cache
async function hydrateCostsFromCache(rawCosts: any[]): Promise<Cost[]> {
  const { getCachedTableData } = await import('@/hooks/useOfflineSync');
  
  const [categoriesResult, cranesResult, operatorsResult, servicesResult, clientsResult] = await Promise.all([
    getCachedTableData<any>('cost_categories'),
    getCachedTableData<any>('cranes'),
    getCachedTableData<any>('operators'),
    getCachedTableData<any>('services'),
    getCachedTableData<any>('clients')
  ]);

  const categories = categoriesResult.data || [];
  const cranes = cranesResult.data || [];
  const operators = operatorsResult.data || [];
  const services = servicesResult.data || [];
  const clients = clientsResult.data || [];

  // Crear mapas para búsqueda rápida
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const craneMap = new Map(cranes.map(c => [c.id, c]));
  const operatorMap = new Map(operators.map(o => [o.id, o]));
  const serviceMap = new Map(services.map(s => [s.id, s]));
  const clientMap = new Map(clients.map(c => [c.id, c]));

  return rawCosts.map(cost => {
    const category = categoryMap.get(cost.category_id);
    const crane = craneMap.get(cost.crane_id);
    const operator = operatorMap.get(cost.operator_id);
    const service = serviceMap.get(cost.service_id);
    const client = service ? clientMap.get(service.client_id) : null;

    return {
      ...cost,
      cost_categories: category || null,
      cranes: crane ? {
        id: crane.id,
        license_plate: crane.licensePlate || crane.license_plate,
        brand: crane.brand,
        model: crane.model,
        type: crane.type
      } : null,
      operators: operator ? {
        id: operator.id,
        name: operator.name,
        rut: operator.rut
      } : null,
      services: service ? {
        ...service,
        folio: service.folio,
        clients: client ? {
          id: client.id,
          name: client.name
        } : null
      } : null
    };
  }) as Cost[];
}

export const useCosts = () => {
  const { effectiveIsOnline } = useOfflineMode();

  return useQuery({
    queryKey: ['costs'],
    queryFn: async () => {
      const { data, isFromCache } = await offlineFetch<Cost>(
        'costs',
        effectiveIsOnline,
        fetchCosts,
        (rawData) => rawData
      );
      
      // Si viene de cache, hidratar con asociaciones
      if (isFromCache && data.length > 0) {
        toast.info('Datos desde cache local', { 
          description: `${data.length} costos cargados offline`,
          duration: 2000
        });
        
        // Hidratar costos con relaciones
        const hydratedCosts = await hydrateCostsFromCache(data);
        return hydratedCosts;
      }
      
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: effectiveIsOnline,
    refetchOnMount: true,
    refetchInterval: effectiveIsOnline ? 30000 : false,
    retry: effectiveIsOnline ? 2 : 0,
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
  const { effectiveIsOnline } = useOfflineMode();
  
  return useMutation({
    mutationFn: async (costData: CostFormData) => {
      // Si está online, usar la función original
      if (effectiveIsOnline) {
        return addCost(costData);
      }
      
      // MODO OFFLINE: Guardar localmente
      console.log('[useAddCost] Offline mode - saving locally');
      const tempId = generateTempId();
      
      const offlineCost = {
        id: tempId,
        ...costData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _isOffline: true,
      };

      const result = await offlineCreate<any>(
        'costs',
        offlineCost,
        false
      );

      return [result.data];
    },
    onSuccess: (data, variables) => {
      console.log('[useAddCost] Mutation success with data:', data);
      
      const isOffline = (data?.[0] as any)?._isOffline;
      if (isOffline) {
        toast.success('Costo guardado localmente', {
          description: 'Se sincronizará automáticamente al reconectar'
        });
      } else {
        toast.success('Costo registrado correctamente');
      }
      
      invalidateAll();
      
      if (data?.[0]?.service_id) {
        queryClient.invalidateQueries({ queryKey: ['service-costs', data[0].service_id] });
      }

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
  const { invalidateAll } = useUniversalSync();
  const { effectiveIsOnline } = useOfflineMode();
  
  return useMutation({
    mutationFn: async (params: { id: string } & any) => {
      // Si está online, usar la función original
      if (effectiveIsOnline) {
        return updateCost(params);
      }
      
      // MODO OFFLINE: Actualizar localmente
      console.log('[useUpdateCost] Offline mode - updating locally');
      const { id, ...costData } = params;
      
      const result = await offlineUpdate<any>(
        'costs',
        id,
        { ...costData, _isOffline: true },
        false
      );

      return [result.data];
    },
    onSuccess: (data) => {
      console.log('[useUpdateCost] Mutation success with data:', data);
      
      const isOffline = (data?.[0] as any)?._isOffline;
      if (isOffline) {
        toast.success('Cambios guardados localmente', {
          description: 'Se sincronizarán automáticamente al reconectar'
        });
      } else {
        toast.success('Costo actualizado correctamente');
      }
      
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

export const useDeleteCost = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();
  const { effectiveIsOnline } = useOfflineMode();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Si está online, usar la función original
      if (effectiveIsOnline) {
        return deleteCost(id);
      }
      
      // MODO OFFLINE: Eliminar localmente
      console.log('[useDeleteCost] Offline mode - deleting locally');
      
      const result = await offlineDelete(
        'costs',
        id,
        false
      );

      return result.data;
    },
    onSuccess: (serviceId) => {
      console.log('[useDeleteCost] Cost deleted successfully, service_id:', serviceId);
      
      if (!effectiveIsOnline) {
        toast.success('Eliminación guardada localmente', {
          description: 'Se sincronizará automáticamente al reconectar'
        });
      } else {
        toast.success('Costo eliminado correctamente');
      }
      
      // Invalidate general queries
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      queryClient.refetchQueries({ queryKey: ['reports'] });
      
      // Invalidate service-related queries
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service-costs'] });
      
      if (serviceId) {
        console.log('[useDeleteCost] Invalidating service-costs for service:', serviceId);
        queryClient.invalidateQueries({ queryKey: ['service-costs', serviceId] });
      }
    },
    onError: createMutationErrorHandler({
      title: 'Error al Eliminar Costo',
      context: 'useDeleteCost'
    }),
  });
};
