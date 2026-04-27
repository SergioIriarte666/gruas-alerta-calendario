import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service, ServiceFormData } from '@/types';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';

import { getTodayLocal } from '@/utils/timezoneUtils';

interface CreateServiceOptions {
  silent?: boolean;
  tolerateResourceSyncFailure?: boolean;
}

const getReadableSupabaseError = (error: any, fallback = 'Error desconocido') => {
  if (!error) return fallback;
  if (typeof error === 'string' && error.trim()) return error;

  const parts = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  if (typeof error.code === 'string' && error.code.trim()) {
    return `Código ${error.code}`;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== '{}' ? serialized : fallback;
  } catch {
    return fallback;
  }
};

// Función helper para detectar comisiones existentes y comparar con nuevas
const detectExistingCommissions = async (serviceId: string, newOperators: any[]) => {
  const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
  
  // Obtener comisiones existentes
  const { data: existingCommissions, error } = await supabase
    .from('costs')
    .select('id, operator_id, amount, description')
    .eq('service_id', serviceId)
    .eq('category_id', commissionCategoryId);

  if (error) {
    console.error('Error fetching existing commissions:', error);
    return { toCreate: [], toUpdate: [], toDelete: [], existingCommissions: [] };
  }

  
  
  const desiredOperators = (newOperators || [])
    .filter(op => op?.operatorId && String(op.operatorId).trim() !== '')
    .map(op => ({
      operator_id: String(op.operatorId),
      amount: Number(op.commission || 0),
      hours: op.hours,
    }))
    .filter(op => op.amount > 0);

  const toCreate = [];
  const toUpdate = [];
  const toDelete = [...existingCommissions]; // Start with all existing, remove those that still exist

  for (const operator of desiredOperators) {
    const existingCommission = existingCommissions.find(
      comm => comm.operator_id === operator.operator_id
    );

    if (existingCommission) {
      // Verificar si el monto cambió
      if (Number(existingCommission.amount) !== operator.amount) {
        toUpdate.push({
          id: existingCommission.id,
          operator_id: operator.operator_id,
          amount: operator.amount,
          hours: operator.hours
        });
      }
      // Remover de la lista de eliminación ya que aún existe
      const deleteIndex = toDelete.findIndex(comm => comm.id === existingCommission.id);
      if (deleteIndex > -1) {
        toDelete.splice(deleteIndex, 1);
      }
    } else {
      // Nueva comisión a crear
      toCreate.push({
        operator_id: operator.operator_id,
        amount: operator.amount,
        hours: operator.hours
      });
    }
  }


  return { toCreate, toUpdate, toDelete, existingCommissions };
};

// Función para transformar datos de Supabase a Service con manejo robusto de campos opcionales
const transformToService = (data: any): Service => {
  
  
  // Buscar operador principal en service_resources
  let primaryOperator = data.operator || null; // Legacy fallback
  
  if (data.service_resources && data.service_resources.length > 0) {
    const primaryResource = data.service_resources.find(
      (resource: any) => resource.resource_type === 'operator' && resource.is_primary
    );
    
    if (primaryResource?.operator) {
      primaryOperator = primaryResource.operator;
    } else {
      // Si no hay operador principal marcado, tomar el primero
      const firstOperatorResource = data.service_resources.find(
        (resource: any) => resource.resource_type === 'operator'
      );
      if (firstOperatorResource?.operator) {
        primaryOperator = firstOperatorResource.operator;
      }
    }
  }

  return {
    id: data.id,
    folio: data.folio,
    requestDate: data.request_date,
    serviceDate: data.service_date,
    // Manejo robusto de cliente - puede ser null para algunos tipos de servicio
    client: data.client || {
      id: data.client_id || '',
      name: 'Cliente no disponible',
      rut: '',
      phone: '',
      email: '',
      address: '',
      department: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    purchaseOrder: data.purchase_order || '',
    quoteNumber: data.quote_number || '',
    vehicleBrand: data.vehicle_brand || '',
    vehicleModel: data.vehicle_model || '',
    licensePlate: data.license_plate || '',
    origin: data.origin || '',
    destination: data.destination || '',
    // Manejo robusto de tipo de servicio
    serviceType: data.serviceType || {
      id: data.service_type_id || '',
      name: 'Tipo no disponible',
      description: '',
      basePrice: null,
      isActive: true,
      vehicleInfoOptional: false,
      purchaseOrderRequired: false,
      originRequired: true,
      destinationRequired: true,
      craneRequired: true,
      operatorRequired: true,
      vehicleBrandRequired: true,
      vehicleModelRequired: true,
      licensePlateRequired: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    value: data.value,
    crane: data.crane || null,
    operator: primaryOperator,
    operatorCommission: data.operator_commission || 0,
    status: data.status,
    observations: data.observations || '',
    hasExcess: data.has_excess || false,
    clientCoveredAmount: data.client_covered_amount ?? null, // Preserve null values for proper excess calculation
    excessAmount: data.excess_amount || 0,
    invoiceFolio: data.invoice_folio || undefined,
    invoiceNumeroFiscal: data.invoice_numero_fiscal || undefined,
    // Transform custody fields from snake_case to camelCase
    custodyMode: data.custody_mode || undefined,
    custodyDays: data.custody_days || undefined,
    custodyDailyRate: data.custody_daily_rate || undefined,
    custodyStartDate: data.custody_start_date || undefined,
    custodyEndDate: data.custody_end_date || undefined,
    custodyVehicleType: data.custody_vehicle_type || undefined,
    custodyDiscountPercentage: data.custody_discount_percentage || undefined,
    custodyTotalAmount: data.custody_total_amount || undefined,
    custodyNotes: data.custody_notes || undefined,
    insuredName: data.insured_name || undefined,
    // Outsourced/Third-party service fields
    outsourcedProviderId: data.outsourced_provider_id || undefined,
    outsourcedCost: data.outsourced_cost ?? undefined,
    outsourcedNotes: data.outsourced_notes || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by || undefined,
    creatorName: data.creator?.full_name || data.creator?.email || undefined
  };
};

export const useServiceManager = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  // CREAR SERVICIO
  const createServiceMutation = useMutation({
    mutationFn: async ({
      serviceData,
      options,
    }: {
      serviceData: ServiceFormData;
      options?: CreateServiceOptions;
    }): Promise<Service> => {
      try {

        // Obtener configuración del tipo de servicio para validaciones condicionales
        const { data: serviceTypeConfig } = await supabase
          .from('service_types')
          .select('*')
          .eq('id', serviceData.serviceType)
          .single();

        

        // Obtener el usuario actual para created_by
        const { data: { user } } = await supabase.auth.getUser();
        const createdBy = user?.id || null;

        // VALIDACIÓN INTEGRAL para TODOS los tipos de servicios especiales
        const transformedData = {
          folio: serviceData.folio,
          // Validar fechas - convertir cadenas vacías a null
          request_date: serviceData.requestDate && serviceData.requestDate.trim() !== '' 
            ? serviceData.requestDate 
            : null,
          service_date: serviceData.serviceDate && serviceData.serviceDate.trim() !== '' 
            ? serviceData.serviceDate 
            : null,
          start_time: serviceData.startTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
          end_time: serviceData.endTime || null,
          crane_mileage: serviceData.craneMileage || null,
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null
          client_id: serviceData.client && serviceData.client.trim() !== ''
            ? serviceData.client 
            : null,
          purchase_order: serviceData.purchaseOrder || null,
          quote_number: serviceData.quoteNumber || null,
          
          // VALIDACIÓN INTEGRAL DE CAMPOS DE VEHÍCULO
          // Tipos especiales: Taxi, Traslado de Insumos (vehicle fields false)
          // Lavado, Servicios Mecánicos, Puente Bateria (vehicle_info_optional true)
          vehicle_brand: (!serviceTypeConfig?.vehicle_brand_required && !serviceData.vehicleBrand) 
            ? null 
            : serviceData.vehicleBrand || null,
          vehicle_model: (!serviceTypeConfig?.vehicle_model_required && !serviceData.vehicleModel) 
            ? null 
            : serviceData.vehicleModel || null,
          license_plate: (!serviceTypeConfig?.license_plate_required && !serviceData.licensePlate) 
            ? null 
            : serviceData.licensePlate || null,

          // VALIDACIÓN INTEGRAL DE ORIGEN/DESTINO  
          // Tipos especiales: Custodia, Lavado, Servicios Mecánicos (origin/destination false)
          origin: (!serviceTypeConfig?.origin_required && !serviceData.origin) 
            ? null 
            : serviceData.origin || null,
          destination: (!serviceTypeConfig?.destination_required && !serviceData.destination) 
            ? null 
            : serviceData.destination || null,

          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null
          service_type_id: serviceData.serviceType && serviceData.serviceType.trim() !== '' 
            ? serviceData.serviceType 
            : null,
          value: serviceData.value,
          
          // VALIDACIÓN INTEGRAL DE GRÚA
          // Si el tipo de servicio no requiere grúa Y no se proporciona grúa, guardar null
          // Si se proporciona grúa (ej: carga masiva), guardarla aunque no sea requerida
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null
          crane_id: serviceData.crane && serviceData.crane.trim() !== '' 
            ? serviceData.crane 
            : null,
            
          // VALIDACIÓN INTEGRAL DE OPERADOR
          // Si el tipo de servicio no requiere operador Y no se proporciona, guardar null
          // Si se proporciona operador (ej: carga masiva), guardarlo aunque no sea requerido
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null
          operator_id: serviceData.operators?.[0]?.operatorId && serviceData.operators[0].operatorId.trim() !== '' 
            ? serviceData.operators[0].operatorId 
            : null,
            
          operator_commission: serviceData.operators?.[0]?.commission || 0,
          status: serviceData.status,
          observations: serviceData.observations || null,
          has_excess: serviceData.hasExcess || false,
          client_covered_amount: serviceData.clientCoveredAmount || null,
          excess_amount: serviceData.excessAmount || null,
          // Transform custody fields from camelCase to snake_case con validación
          custody_mode: serviceData.custodyMode || null,
          custody_days: serviceData.custodyDays || null,
          custody_daily_rate: serviceData.custodyDailyRate || null,
          custody_rate_type: serviceData.custodyRateType || null,
          custody_start_date: serviceData.custodyStartDate && serviceData.custodyStartDate.trim() !== '' 
            ? serviceData.custodyStartDate 
            : null,
          custody_end_date: serviceData.custodyEndDate && serviceData.custodyEndDate.trim() !== '' 
            ? serviceData.custodyEndDate 
            : null,
          custody_vehicle_type: serviceData.custodyVehicleType || null,
          custody_discount_percentage: serviceData.custodyDiscountPercentage || null,
          custody_total_amount: serviceData.custodyTotalAmount || null,
          custody_notes: serviceData.custodyNotes || null,
          insured_name: serviceData.insuredName || null,
          // Outsourced/Third-party service fields
          outsourced_provider_id: serviceData.outsourcedProviderId && serviceData.outsourcedProviderId.trim() !== '' 
            ? serviceData.outsourcedProviderId 
            : null,
          outsourced_cost: serviceData.outsourcedCost || 0,
          outsourced_notes: serviceData.outsourcedNotes || null,
          created_by: createdBy
        };


        const { data: newService, error: serviceError } = await supabase
          .from('services')
          .insert(transformedData)
          .select(`
            *,
            client:clients!services_client_id_fkey(*),
            third_party_client:clients!services_third_party_client_id_fkey(*),
            crane:cranes(*),
            operator:operators(*),
            serviceType:service_types(*),
            creator:profiles!services_created_by_fkey(id, full_name, email)
          `)
          .single();

        if (serviceError) {
          throw new Error(getReadableSupabaseError(serviceError));
        }
        
        // Si hay operadores, crearlos en service_resources
        if (serviceData.operators && serviceData.operators.length > 0) {
          const operatorPromises = serviceData.operators.map(async (op, index) => {
            const operatorData = {
              service_id: newService.id,
              resource_type: 'operator',
              operator_id: op.operatorId,
              is_primary: index === 0,
              commission_amount: op.commission,
              role: op.role || 'Principal'
            };
            
            const { error: operatorError } = await supabase
              .from('service_resources')
              .insert(operatorData);
              
            if (operatorError) throw operatorError;
          });

          try {
            await Promise.all(operatorPromises);
          } catch (resourceError) {
            const readableResourceError = getReadableSupabaseError(resourceError);

            if (!options?.tolerateResourceSyncFailure) {
              throw new Error(readableResourceError);
            }

            console.error('[useServiceManager - createService] Non-blocking service_resources error:', resourceError);
          }
        }

        // Si hay costos, crearlos
        if (serviceData.costDetails && serviceData.costDetails.length > 0) {
          const costPromises = serviceData.costDetails.map(async (cost) => {
            const { data: category } = await supabase
              .from('cost_categories')
              .select('id')
              .eq('name', 'Gastos de Servicios')
              .single();

            const costData = {
              service_id: newService.id,
              amount: cost.amount,
              description: cost.description,
              date: transformedData.service_date,
              payment_date: serviceData.markCostsPaidOnCreate ? transformedData.service_date : null,
              notes: cost.notes || 'Costo desde formulario de servicio',
              category_id: cost.category_id || category?.id,
              crane_id: newService.crane_id,
              service_folio: newService.folio,
              subcategory: cost.subcategory,
              supplier_id: (cost as any).supplier_id || null,
              operator_id: (cost as any).operator_id || null,
              document_type: (cost as any).document_type || null,
              document_number: (cost as any).document_number || null,
              location_text: (cost as any).location_text || null,
              other_reason: (cost as any).other_reason || null,
              purchase_quantity: (cost as any).purchase_quantity || null,
              purchase_unit_cost: (cost as any).purchase_unit_cost || null,
              immediate_consumption: !!(cost as any).immediate_consumption,
            };
            
            const { error: costError } = await supabase
              .from('costs')
              .insert(costData);
              
            if (costError) throw costError;
          });
          
          await Promise.all(costPromises);
        }

        // Si es servicio subcontratado, crear el costo del tercero automáticamente
        if (serviceTypeConfig?.is_outsourced && serviceData.outsourcedProviderId && serviceData.outsourcedCost && serviceData.outsourcedCost > 0) {
          
          
          // Buscar o crear categoría de Subcontrataciones
          let categoryId: string | null = null;
          const { data: existingCategory } = await supabase
            .from('cost_categories')
            .select('id')
            .eq('name', 'Subcontrataciones')
            .single();

          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Usar categoría de Gastos de Servicios como fallback
            const { data: fallbackCategory } = await supabase
              .from('cost_categories')
              .select('id')
              .eq('name', 'Gastos de Servicios')
              .single();
            categoryId = fallbackCategory?.id || null;
          }

          if (categoryId) {
            const outsourcedCostData = {
              service_id: newService.id,
              amount: serviceData.outsourcedCost,
              description: `Servicio tercerizado: ${newService.folio}`,
              date: transformedData.service_date,
              payment_date: serviceData.markCostsPaidOnCreate ? transformedData.service_date : null,
              notes: serviceData.outsourcedNotes || 'Costo de proveedor tercero creado automáticamente',
              category_id: categoryId,
              subcategory: 'Servicios Terceros',
              supplier_id: serviceData.outsourcedProviderId,
              service_folio: newService.folio
            };

            const { error: outsourcedCostError } = await supabase
              .from('costs')
              .insert(outsourcedCostData);

            if (outsourcedCostError) {
              console.error('Error creating outsourced cost:', outsourcedCostError);
              // No lanzar error, solo log - el servicio ya se creó
            }
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['services'] });
        await queryClient.invalidateQueries({ queryKey: ['costs'] });
        
        const transformedService = transformToService(newService);
        return transformedService;

      } catch (error) {
        console.error('Error en creación de servicio:', error);
        throw error instanceof Error
          ? error
          : new Error(getReadableSupabaseError(error, 'No se pudo crear el servicio'));
      }
    },
    onSuccess: (_data, variables) => {
      if (!variables.options?.silent) {
        toast.success('Servicio creado exitosamente');
      }
    },
    onError: (error: any, variables) => {
      console.error('[useServiceManager - createService] Error:', error);

      if (variables.options?.silent) {
        return;
      }

      createMutationErrorHandler({
        title: 'Error al Crear Servicio',
        context: 'useServiceManager - createService'
      })(error);
    }
  });

  // ACTUALIZAR SERVICIO
  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, serviceData }: { 
      id: string; 
      serviceData: Partial<ServiceFormData> & { purchaseOrderNumber?: string } 
    }): Promise<Service> => {
      // Transformar datos para Supabase con validación de fechas y UUIDs

      // 🚀 DETECTAR ACTUALIZACIÓN PARCIAL (batch update)
      const isPartialUpdate = Object.keys(serviceData).length <= 4 && 
                            (serviceData.quoteNumber !== undefined || serviceData.purchaseOrder !== undefined || serviceData.purchaseOrderNumber !== undefined || serviceData.status !== undefined) &&
                            !serviceData.requestDate && !serviceData.serviceDate;

      

      let transformedData: any = {};

      // Obtener estado real actual para auto-transiciones de flujo VIP
      let currentStatus: Service['status'] | undefined;
      const shouldResolveCurrentStatus =
        serviceData.quoteNumber !== undefined ||
        serviceData.purchaseOrderNumber !== undefined ||
        serviceData.status !== undefined;

      if (shouldResolveCurrentStatus) {
        const { data: currentService } = await supabase
          .from('services')
          .select('status')
          .eq('id', id)
          .single();

        currentStatus = currentService?.status as Service['status'] | undefined;
      }

      if (isPartialUpdate) {
        // ✅ ACTUALIZACIÓN PARCIAL - Solo procesar campos específicos enviados
        
        // Usar estado actual precargado para auto-transiciones

        
        if (serviceData.quoteNumber !== undefined) {
          transformedData.quote_number = serviceData.quoteNumber;
          // Auto-transición: completed + quote_number -> quoted
          if (currentStatus === 'completed' && serviceData.quoteNumber && !serviceData.status) {
            transformedData.status = 'quoted';
          }
        }
        if (serviceData.purchaseOrder !== undefined) {
          transformedData.purchase_order = serviceData.purchaseOrder;
        }
        if (serviceData.purchaseOrderNumber !== undefined) {
          transformedData.purchase_order_number = serviceData.purchaseOrderNumber;
          // Auto-transición: quoted/purchase_order_pending + purchase_order_number -> with_purchase_order
          if ((currentStatus === 'quoted' || currentStatus === 'purchase_order_pending') && serviceData.purchaseOrderNumber && !serviceData.status) {
            transformedData.status = 'with_purchase_order';
          }
        }
        if (serviceData.status !== undefined) {
          transformedData.status = serviceData.status;
        }
      } else {
        // ✅ ACTUALIZACIÓN COMPLETA - Procesar todos los campos con validación
        
        
        // Extraer operador principal para operator_id y operator_commission
        let primaryOperatorId = null;
        let primaryOperatorCommission = 0;
        
        if (serviceData.operators && Array.isArray(serviceData.operators) && serviceData.operators.length > 0) {
          const primaryOperator = serviceData.operators[0];
          primaryOperatorId = primaryOperator.operatorId || null;
          primaryOperatorCommission = primaryOperator.commission || 0;
          
        }
        
        transformedData = {
          // ✅ CRÍTICO: Agregar folio
          ...(serviceData.folio !== undefined && {
            folio: serviceData.folio
          }),
          // Validar fechas - convertir cadenas vacías a null SOLO si están presentes
          ...(serviceData.requestDate !== undefined && {
            request_date: serviceData.requestDate && serviceData.requestDate.trim() !== '' 
              ? serviceData.requestDate 
              : null
          }),
          ...(serviceData.serviceDate !== undefined && {
            service_date: serviceData.serviceDate && serviceData.serviceDate.trim() !== '' 
              ? serviceData.serviceDate 
              : null
          }),
          ...(serviceData.startTime !== undefined && {
            start_time: serviceData.startTime || null
          }),
          ...(serviceData.endTime !== undefined && {
            end_time: serviceData.endTime || null
          }),
          ...(serviceData.craneMileage !== undefined && {
            crane_mileage: serviceData.craneMileage || null
          }),
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null SOLO si están presentes
          // Normalizar client: puede ser string (ID) u objeto completo
          ...(serviceData.client !== undefined && {
            client_id: (() => {
              const clientValue = serviceData.client;
              // Null o undefined
              if (!clientValue) return null;
              // Si es un objeto, extraer el ID
              if (typeof clientValue === 'object') {
                return (clientValue as any).id || null;
              }
              // Si es un string, validar que no esté vacío
              if (typeof clientValue === 'string') {
                return clientValue.trim() !== '' ? clientValue : null;
              }
              return null;
            })()
          }),
          ...(serviceData.purchaseOrderNumber !== undefined && {
            purchase_order_number: serviceData.purchaseOrderNumber
          }),
          ...(serviceData.purchaseOrder !== undefined && {
            purchase_order: serviceData.purchaseOrder
          }),
          ...(serviceData.quoteNumber !== undefined && {
            quote_number: serviceData.quoteNumber
          }),
          // Normalizar serviceType: puede ser string (ID) u objeto completo
          ...(serviceData.serviceType !== undefined && {
            service_type_id: (() => {
              const typeValue = serviceData.serviceType;
              if (!typeValue) return null;
              if (typeof typeValue === 'object') {
                return (typeValue as any).id || null;
              }
              if (typeof typeValue === 'string') {
                return typeValue.trim() !== '' ? typeValue : null;
              }
              return null;
            })()
          }),
          // Normalizar crane: puede ser string (ID) u objeto completo
          ...(serviceData.crane !== undefined && {
            crane_id: (() => {
              const craneValue = serviceData.crane;
              if (!craneValue) return null;
              if (typeof craneValue === 'object') {
                return (craneValue as any).id || null;
              }
              if (typeof craneValue === 'string') {
                return craneValue.trim() !== '' ? craneValue : null;
              }
              return null;
            })()
          }),
          // ✅ CRÍTICO: Mantener campos de vehículo (NO eliminar)
          ...(serviceData.vehicleBrand !== undefined && {
            vehicle_brand: serviceData.vehicleBrand
          }),
          ...(serviceData.vehicleModel !== undefined && {
            vehicle_model: serviceData.vehicleModel
          }),
          ...(serviceData.licensePlate !== undefined && {
            license_plate: serviceData.licensePlate
          }),
          ...(serviceData.origin !== undefined && {
            origin: serviceData.origin
          }),
          ...(serviceData.destination !== undefined && {
            destination: serviceData.destination
          }),
          ...(serviceData.value !== undefined && {
            value: serviceData.value
          }),
          ...(serviceData.status !== undefined && {
            status: serviceData.status
          }),
          ...(serviceData.observations !== undefined && {
            observations: serviceData.observations
          }),
          // ✅ CRÍTICO: Mantener campos de exceso (NO eliminar)
          ...(serviceData.hasExcess !== undefined && {
            has_excess: serviceData.hasExcess
          }),
          ...(serviceData.clientCoveredAmount !== undefined && {
            client_covered_amount: serviceData.clientCoveredAmount
          }),
          ...(serviceData.excessAmount !== undefined && {
            excess_amount: serviceData.excessAmount || null
          }),
          // ✅ CRÍTICO: Agregar operator_id y operator_commission
          ...(primaryOperatorId !== null && {
            operator_id: primaryOperatorId,
            operator_commission: primaryOperatorCommission
          }),
          // Transform custody fields from camelCase to snake_case con validación SOLO si están presentes
          ...(serviceData.custodyMode !== undefined && {
            custody_mode: serviceData.custodyMode
          }),
          ...(serviceData.custodyDays !== undefined && {
            custody_days: serviceData.custodyDays
          }),
          ...(serviceData.custodyDailyRate !== undefined && {
            custody_daily_rate: serviceData.custodyDailyRate
          }),
          ...(serviceData.custodyRateType !== undefined && {
            custody_rate_type: serviceData.custodyRateType
          }),
          ...(serviceData.custodyStartDate !== undefined && {
            custody_start_date: serviceData.custodyStartDate && serviceData.custodyStartDate.trim() !== '' 
              ? serviceData.custodyStartDate 
              : null
          }),
          ...(serviceData.custodyEndDate !== undefined && {
            custody_end_date: serviceData.custodyEndDate && serviceData.custodyEndDate.trim() !== '' 
              ? serviceData.custodyEndDate 
              : null
          }),
          ...(serviceData.custodyVehicleType !== undefined && {
            custody_vehicle_type: serviceData.custodyVehicleType
          }),
          ...(serviceData.custodyDiscountPercentage !== undefined && {
            custody_discount_percentage: serviceData.custodyDiscountPercentage
          }),
          ...(serviceData.custodyTotalAmount !== undefined && {
            custody_total_amount: serviceData.custodyTotalAmount
          }),
          ...(serviceData.custodyNotes !== undefined && {
            custody_notes: serviceData.custodyNotes
          }),
          ...(serviceData.insuredName !== undefined && {
            insured_name: serviceData.insuredName
          }),
          // ✅ CAMPOS OUTSOURCED - Proveedor tercerizado
          ...(serviceData.outsourcedProviderId !== undefined && {
            outsourced_provider_id: serviceData.outsourcedProviderId && serviceData.outsourcedProviderId.trim() !== '' 
              ? serviceData.outsourcedProviderId 
              : null
          }),
          ...(serviceData.outsourcedCost !== undefined && {
            outsourced_cost: serviceData.outsourcedCost || 0
          }),
          ...(serviceData.outsourcedNotes !== undefined && {
            outsourced_notes: serviceData.outsourcedNotes || null
          })
        };
      }

      // Auto-transiciones de flujo VIP también para actualizaciones completas
      const isStatusUnchanged = serviceData.status === undefined || serviceData.status === currentStatus;
      if (isStatusUnchanged && currentStatus === 'completed' && transformedData.quote_number) {
        transformedData.status = 'quoted';
      }
      if (
        isStatusUnchanged &&
        (currentStatus === 'quoted' || currentStatus === 'purchase_order_pending') &&
        transformedData.purchase_order_number
      ) {
        transformedData.status = 'with_purchase_order';
      }

      // ✅ CRÍTICO: Solo remover campos que NO pertenecen a la tabla services
      // Estos son campos auxiliares del form que no se mapean directamente
      delete transformedData.client;
      delete transformedData.serviceType;
      delete transformedData.crane;
      delete transformedData.costDetails;
      delete transformedData.operators;
      
      

      // ✅ MODIFICADO: Handle service costs (gastos) update con prevención de duplicación
      if (serviceData.costDetails && Array.isArray(serviceData.costDetails)) {
      // ✅ NUEVO: Solo procesar costos si viene del formulario principal
      const isFromMainForm = (serviceData as any)._source === 'main_form' || (serviceData as any)._processCosts === true;
      
      if (isFromMainForm) {
        
        
        const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
        
        // Delete existing costs for this service (exclude commissions)
        const { error: deleteCostsError } = await supabase
          .from('costs')
          .delete()
          .eq('service_id', id)
          .neq('category_id', commissionCategoryId);
      
        if (deleteCostsError) {
          console.error('[updateService] Error deleting existing service costs:', deleteCostsError);
        }
      
        // Filter valid cost details
        const validCostDetails = serviceData.costDetails.filter(cost => 
          cost.description && cost.amount > 0 && cost.category_id
        );
      
        if (validCostDetails.length > 0) {
          // Get current service data for foreign keys
          const { data: currentService } = await supabase
            .from('services')
            .select('folio, service_date, crane_id')
            .eq('id', id)
            .single();
      
          const serviceCosts = validCostDetails.map(cost => ({
            amount: cost.amount,
            category_id: cost.category_id,
            service_id: id,
            service_folio: currentService?.folio || 'Unknown',
            date: currentService?.service_date || serviceData.serviceDate || getTodayLocal(),
            description: cost.description,
            subcategory: cost.subcategory || null,
            notes: cost.notes || 'Costo actualizado desde formulario de servicio',
            crane_id: currentService?.crane_id,
            created_by: null
          }));
      
          
      
          const { error: insertCostsError } = await supabase
            .from('costs')
            .insert(serviceCosts);
      
          if (insertCostsError) {
            console.error('[updateService] Error inserting updated service costs:', insertCostsError);
          }
        }
      }
      }

      // ✅ NEW: Handle operators update
      if (serviceData.operators && Array.isArray(serviceData.operators)) {
        
        
        const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
        
        // 1. Actualizar operador principal en la tabla services
        const mainOperator = serviceData.operators.find(op => op.role === 'Principal') || serviceData.operators[0];
        if (mainOperator && mainOperator.operatorId && mainOperator.operatorId.trim() !== '') {
          (transformedData as any).operator_id = mainOperator.operatorId;
          (transformedData as any).operator_commission = mainOperator.commission || 0;
        } else {
          (transformedData as any).operator_id = null;
          (transformedData as any).operator_commission = 0;
        }
        
        // 2. DETECCIÓN INTELIGENTE DE COMISIONES - Evitar eliminación/creación innecesaria
        
        
        const { toCreate, toUpdate, toDelete } = await detectExistingCommissions(id, serviceData.operators);
        
        // Get current service data for foreign keys
        const { data: currentService } = await supabase
          .from('services')
          .select('folio, service_date, crane_id')
          .eq('id', id)
          .single();

        // 3. ELIMINAR solo las comisiones que ya no existen
        if (toDelete.length > 0) {
          
          
          const { error: deleteCommissionsError } = await supabase
            .from('costs')
            .delete()
            .in('id', toDelete.map(c => c.id));

          if (deleteCommissionsError) {
            console.error('[SMART SYNC] Error deleting obsolete commissions:', deleteCommissionsError);
          }
        }

        // 4. ACTUALIZAR comisiones existentes que cambiaron
        if (toUpdate.length > 0) {
          
          
          for (const updateData of toUpdate) {
            const { error: updateError } = await supabase
              .from('costs')
              .update({
                amount: updateData.amount,
                notes: updateData.hours ? `${updateData.hours} horas trabajadas` : null,
                updated_at: new Date().toISOString()
              })
              .eq('id', updateData.id);

            if (updateError) {
              console.error('[SMART SYNC] Error updating commission:', updateError);
            }
          }
          
        }

        // 5. CREAR solo las nuevas comisiones
        if (toCreate.length > 0) {
          
          
          const newCommissionCosts = toCreate.map(operator => ({
            amount: operator.amount,
            category_id: commissionCategoryId,
            service_id: id,
            service_folio: currentService?.folio || 'Unknown',
            date: currentService?.service_date || serviceData.serviceDate || getTodayLocal(),
            description: `Comisión operador - Servicio ${currentService?.folio || id}`,
            subcategory: 'comisiones',
            notes: operator.hours ? `${operator.hours} horas trabajadas` : null,
            operator_id: operator.operator_id,
            crane_id: currentService?.crane_id,
            created_by: null
          }));

          // Insertar nuevas comisiones con manejo seguro de duplicados
          const { error: insertCommissionsError } = await supabase
            .from('costs')
            .insert(newCommissionCosts);

          if (insertCommissionsError) {
            console.error('[SMART SYNC] Error inserting new commission costs:', insertCommissionsError);
            
            // Fallback: Intentar inserción individual con manejo de errores de duplicados
            for (const cost of newCommissionCosts) {
              const { error: individualError } = await supabase
                .from('costs')
                .insert(cost);
                
              if (individualError) {
                // Solo reportar errores que no sean de duplicados
                if (!individualError.message.includes('duplicate') && 
                    !individualError.message.includes('violates unique constraint')) {
                  console.error('[SMART SYNC] Individual insert error:', individualError);
                }
              }
            }
          }
        }
        
        
        
        // 6. SINCRONIZAR service_resources - Actualizar/crear/eliminar registros de operadores
        
        
        // Obtener registros actuales de service_resources para este servicio
        const { data: currentResources } = await supabase
          .from('service_resources')
          .select('id, operator_id, role, commission_amount')
          .eq('service_id', id)
          .eq('resource_type', 'operator');
        
        
        
        // Crear un set de operator_ids de los operadores nuevos
        const newOperatorIds = new Set(serviceData.operators.map(op => op.operatorId).filter(Boolean));
        
        // Eliminar registros de operadores que ya no existen
        if (currentResources && currentResources.length > 0) {
          const resourcesToDelete = currentResources.filter(
            resource => !newOperatorIds.has(resource.operator_id)
          );
          
          if (resourcesToDelete.length > 0) {
            const { error: deleteResourcesError } = await supabase
              .from('service_resources')
              .delete()
              .in('id', resourcesToDelete.map(r => r.id));
            
            if (deleteResourcesError) {
              console.error('[SERVICE_RESOURCES] Error deleting obsolete resources:', deleteResourcesError);
            }
          }
        }
        
        // Actualizar o crear registros de operadores
        for (const [index, operator] of serviceData.operators.entries()) {
          if (!operator.operatorId || operator.operatorId.trim() === '') continue;
          
          const existingResource = currentResources?.find(
            r => r.operator_id === operator.operatorId
          );
          
          if (existingResource) {
            // Actualizar registro existente
            const { error: updateResourceError } = await supabase
              .from('service_resources')
              .update({
                is_primary: index === 0,
                commission_amount: operator.commission || 0,
                role: operator.role || 'Principal',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingResource.id);
            
            if (updateResourceError) {
              console.error('[SERVICE_RESOURCES] Error updating resource:', updateResourceError);
            }
          } else {
            // Crear nuevo registro
            const { error: createResourceError } = await supabase
              .from('service_resources')
              .insert({
                service_id: id,
                resource_type: 'operator',
                operator_id: operator.operatorId,
                is_primary: index === 0,
                commission_amount: operator.commission || 0,
                role: operator.role || 'Principal'
              });
            
            if (createResourceError) {
              console.error('[SERVICE_RESOURCES] Error creating resource:', createResourceError);
            }
          }
        }
        
        
      }

      // Remove costDetails and operators after processing
      delete (transformedData as any).costDetails;
      delete (transformedData as any).operators;

      const { data: updatedService, error } = await supabase
        .from('services')
        .update(transformedData)
        .eq('id', id)
        .select(`
          *,
          client:clients!services_client_id_fkey(*),
          third_party_client:clients!services_third_party_client_id_fkey(*),
          crane:cranes(*),
          operator:operators(*),
          serviceType:service_types(*),
          service_resources!service_resources_service_id_fkey(
            id,
            resource_type,
            operator_id,
            crane_id,
            is_primary,
            commission_amount,
            role,
            operator:operators(*),
            crane:cranes(*)
          )
        `)
        .single();

      if (error) {
        console.error('Error updating service:', error);
        throw new Error(`Error al actualizar servicio: ${error.message || 'Error desconocido'}`);
      }

      if (!updatedService) {
        throw new Error('No se recibió confirmación de la actualización del servicio');
      }

      // ✅ SINCRONIZACIÓN DE COSTO OUTSOURCED Y SUPPLIER_PAYMENTS
      // Si el servicio tiene proveedor tercerizado, actualizar/crear el costo y el pago asociado
      if (serviceData.outsourcedProviderId !== undefined) {
        
        
        // Buscar el costo existente del servicio tercerizado
        const { data: existingOutsourcedCost, error: findCostError } = await supabase
          .from('costs')
          .select('id')
          .eq('service_id', id)
          .ilike('description', 'Servicio tercerizado:%')
          .maybeSingle();

        if (findCostError) {
          console.error('[OUTSOURCED SYNC] Error buscando costo existente:', findCostError);
        } else if (existingOutsourcedCost) {
          const newSupplierId = serviceData.outsourcedProviderId && serviceData.outsourcedProviderId.trim() !== '' 
            ? serviceData.outsourcedProviderId 
            : null;

          // Actualizar el costo existente con el nuevo proveedor y monto
          const { error: updateCostError } = await supabase
            .from('costs')
            .update({
              amount: serviceData.outsourcedCost || 0,
              supplier_id: newSupplierId,
              notes: serviceData.outsourcedNotes || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingOutsourcedCost.id);

          if (updateCostError) {
            console.error('[OUTSOURCED SYNC] Error actualizando costo outsourced:', updateCostError);
          } else {

            // ✅ TAMBIÉN actualizar el supplier_payment asociado a este costo
            const { data: existingPayment, error: findPaymentError } = await supabase
              .from('supplier_payments')
              .select('id')
              .eq('cost_id', existingOutsourcedCost.id)
              .maybeSingle();

            if (findPaymentError) {
              console.error('[OUTSOURCED SYNC] Error buscando payment existente:', findPaymentError);
            } else if (existingPayment) {
              const { error: updatePaymentError } = await supabase
                .from('supplier_payments')
                .update({
                  amount: serviceData.outsourcedCost || 0,
                  supplier_id: newSupplierId,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingPayment.id);

              if (updatePaymentError) {
                console.error('[OUTSOURCED SYNC] Error actualizando supplier_payment:', updatePaymentError);
              }
            }
          }
        } else if (
          serviceData.outsourcedProviderId && 
          serviceData.outsourcedProviderId.trim() !== '' && 
          serviceData.outsourcedCost && 
          serviceData.outsourcedCost > 0
        ) {
          // ✅ NUEVO: Si no existe el costo pero el servicio tiene proveedor + monto > 0, CREARLO
          console.log('[OUTSOURCED SYNC] Costo no encontrado, creando nuevo costo outsourced...');
          
          let categoryId: string | null = null;
          const { data: existingCategory } = await supabase
            .from('cost_categories')
            .select('id')
            .eq('name', 'Subcontrataciones')
            .single();

          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            const { data: fallbackCategory } = await supabase
              .from('cost_categories')
              .select('id')
              .eq('name', 'Gastos de Servicios')
              .single();
            categoryId = fallbackCategory?.id || null;
          }

          if (categoryId) {
            const { data: svcData } = await supabase
              .from('services')
              .select('folio, service_date')
              .eq('id', id)
              .single();

            const { error: createCostError } = await supabase
              .from('costs')
              .insert({
                service_id: id,
                amount: serviceData.outsourcedCost,
                description: `Servicio tercerizado: ${svcData?.folio || id}`,
                date: svcData?.service_date || getTodayLocal(),
                notes: serviceData.outsourcedNotes || 'Costo de proveedor tercero creado automáticamente',
                category_id: categoryId,
                subcategory: 'Servicios Terceros',
                supplier_id: serviceData.outsourcedProviderId,
                service_folio: svcData?.folio || id
              });

            if (createCostError) {
              console.error('[OUTSOURCED SYNC] Error creando costo outsourced:', createCostError);
            } else {
              console.log('[OUTSOURCED SYNC] ✅ Costo outsourced creado exitosamente');
            }
          }
        }
      }

      // Invalidar todas las queries relacionadas para asegurar datos actualizados
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', id] }),
        queryClient.invalidateQueries({ queryKey: ['service-costs', id] }),
        queryClient.invalidateQueries({ queryKey: ['costs'] }),
        queryClient.invalidateQueries({ queryKey: ['commissions'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier-payments'] }),
        // ✅ Detalle proveedor (modal) usa estas keys, si no, queda cache viejo
        queryClient.invalidateQueries({ queryKey: ['supplier-detail-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier-stats'] })
      ]);
      
      return transformToService(updatedService);
    },
    onSuccess: () => {
      toast.success('Servicio actualizado exitosamente');
    },
    onError: (error: any) => {
      console.error('Error updating service:', error);
      
      let errorMessage = 'Error al actualizar servicio';
      
      // Detectar tipo específico de error
      if (error?.message) {
        if (error.message.includes('violates row-level security')) {
          errorMessage = 'Error de permisos: No tienes autorización para actualizar este servicio';
        } else if (error.message.includes('violates foreign key constraint')) {
          errorMessage = 'Error de datos: Una de las referencias (cliente, grúa, operador) no es válida';
        } else if (error.message.includes('violates check constraint')) {
          errorMessage = 'Error de validación: Los datos no cumplen con las restricciones de la base de datos';
        } else if (error.message.includes('duplicate key')) {
          errorMessage = 'Error: Ya existe un registro con estos datos';
        } else if (error.message.includes('not-null constraint')) {
          errorMessage = 'Error: Faltan campos obligatorios';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      } else if (error?.code) {
        errorMessage = `Error (${error.code}): ${error.details || error.hint || 'Error desconocido'}`;
      }
      
      
      toast.error(errorMessage);
    }
  });

  // ELIMINAR SERVICIO - Usa RPC delete_service_cascade para eliminar en cascada
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      
      
      const { error } = await supabase.rpc('delete_service_cascade', {
        p_service_id: id
      });

      if (error) {
        console.error('Error eliminando servicio:', error);
        throw new Error(`Error al eliminar el servicio: ${error.message}`);
      }
      
      
      await queryClient.invalidateQueries({ queryKey: ['services'] });
      await queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
    onSuccess: () => {
      toast.success('Servicio eliminado correctamente');
    },
    onError: (error: Error) => {
      console.error('Error eliminando servicio:', error);
      toast.error(error.message || 'Error al eliminar el servicio');
    }
  });

  // Estados de carga unificados
  const isLoading = createServiceMutation.isPending || updateServiceMutation.isPending || deleteServiceMutation.isPending;

  // Funciones públicas
  const createService = async (serviceData: ServiceFormData, options?: CreateServiceOptions): Promise<Service> => {
    return createServiceMutation.mutateAsync({ serviceData, options });
  };

  const updateService = async (id: string, serviceData: Partial<ServiceFormData>): Promise<Service> => {
    return updateServiceMutation.mutateAsync({ id, serviceData });
  };

  const deleteService = async (id: string): Promise<void> => {
    return deleteServiceMutation.mutateAsync(id);
  };

  return {
    createService,
    updateService,
    deleteService,
    isLoading,
    isCreating: createServiceMutation.isPending,
    isUpdating: updateServiceMutation.isPending,
    isDeleting: deleteServiceMutation.isPending
  };
};
