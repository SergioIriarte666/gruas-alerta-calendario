import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service, ServiceFormData } from '@/types';
import { toast } from 'sonner';
import { useErrorHandler } from '@/hooks/useErrorHandler';

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

  console.log('🔍 [SMART SYNC] Existing commissions:', existingCommissions);
  
  // Filtrar operadores adicionales (excluyendo el principal)
  const mainOperator = newOperators.find(op => op.role === 'Principal') || newOperators[0];
  const additionalOperators = newOperators.filter(op => 
    op.role !== 'Principal' && 
    op !== mainOperator &&
    op.operatorId && 
    op.operatorId.trim() !== ''
  );

  const toCreate = [];
  const toUpdate = [];
  const toDelete = [...existingCommissions]; // Start with all existing, remove those that still exist

  // Comparar cada operador adicional con las comisiones existentes
  for (const operator of additionalOperators) {
    const existingCommission = existingCommissions.find(
      comm => comm.operator_id === operator.operatorId
    );

    if (existingCommission) {
      // Verificar si el monto cambió
      if (existingCommission.amount !== (operator.commission || 0)) {
        toUpdate.push({
          id: existingCommission.id,
          operator_id: operator.operatorId,
          amount: operator.commission || 0,
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
        operator_id: operator.operatorId,
        amount: operator.commission || 0,
        hours: operator.hours
      });
    }
  }

  console.log('🔍 [SMART SYNC] Analysis result:', {
    toCreate: toCreate.length,
    toUpdate: toUpdate.length,
    toDelete: toDelete.length
  });

  return { toCreate, toUpdate, toDelete, existingCommissions };
};

// Función para transformar datos de Supabase a Service con manejo robusto de campos opcionales
const transformToService = (data: any): Service => {
  console.log('🔄 Transforming service data:', { folio: data.folio, hasClient: !!data.client, hasServiceType: !!data.serviceType });
  
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
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

export const useServiceManager = () => {
  const queryClient = useQueryClient();
  const { createMutationErrorHandler } = useErrorHandler();

  // CREAR SERVICIO
  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: ServiceFormData): Promise<Service> => {
      try {
        console.log('🔄 Creating service with data:', { 
          folio: serviceData.folio, 
          serviceType: serviceData.serviceType,
          hasOperators: !!serviceData.operators?.length,
          hasCrane: !!serviceData.crane
        });

        // Obtener configuración del tipo de servicio para validaciones condicionales
        const { data: serviceTypeConfig } = await supabase
          .from('service_types')
          .select('*')
          .eq('id', serviceData.serviceType)
          .single();

        console.log('📋 Service type config:', serviceTypeConfig);

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
          // Tipos especiales: Custodia, Lavado, Servicios Mecánicos (crane_required false)
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null
          crane_id: !serviceTypeConfig?.crane_required 
            ? null 
            : (serviceData.crane && serviceData.crane.trim() !== '' ? serviceData.crane : null),
            
          // VALIDACIÓN INTEGRAL DE OPERADOR
          // Tipos especiales: Custodia, Lavado, Servicios Mecánicos (operator_required false)
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null
          operator_id: !serviceTypeConfig?.operator_required 
            ? null 
            : (serviceData.operators?.[0]?.operatorId && serviceData.operators[0].operatorId.trim() !== '' 
               ? serviceData.operators[0].operatorId 
               : null),
            
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
          custody_notes: serviceData.custodyNotes || null
        };

        console.log('📤 [INTEGRAL] Transformed data for ALL special service types:', {
          serviceType: serviceTypeConfig?.name,
          config: {
            vehicle_brand_required: serviceTypeConfig?.vehicle_brand_required,
            vehicle_model_required: serviceTypeConfig?.vehicle_model_required,
            license_plate_required: serviceTypeConfig?.license_plate_required,
            origin_required: serviceTypeConfig?.origin_required,
            destination_required: serviceTypeConfig?.destination_required,
            crane_required: serviceTypeConfig?.crane_required,
            operator_required: serviceTypeConfig?.operator_required,
            vehicle_info_optional: serviceTypeConfig?.vehicle_info_optional
          },
          finalData: transformedData
        });

        const { data: newService, error: serviceError } = await supabase
          .from('services')
          .insert(transformedData)
          .select(`
            *,
            client:clients(*),
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
              operator:operators(*)
            )
          `)
          .single();

        if (serviceError) {
          throw serviceError;
        }
        
        // Si hay operadores, crearlos en service_resources
        if (serviceData.operators && serviceData.operators.length > 0) {
          const operatorPromises = serviceData.operators.map(async (op, index) => {
            const operatorData = {
              service_id: newService.id,
              resource_type: 'operator',
              operator_id: op.operatorId,
              is_primary: index === 0,
              commission_amount: op.commission
            };
            
            const { error: operatorError } = await supabase
              .from('service_resources')
              .insert(operatorData);
              
            if (operatorError) throw operatorError;
          });
          
          await Promise.all(operatorPromises);
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
              notes: cost.notes || 'Costo desde formulario de servicio',
              category_id: category?.id || cost.category_id,
              crane_id: newService.crane_id,
              service_folio: newService.folio,
              subcategory: cost.subcategory
            };
            
            const { error: costError } = await supabase
              .from('costs')
              .insert(costData);
              
            if (costError) throw costError;
          });
          
          await Promise.all(costPromises);
        }

        await queryClient.invalidateQueries({ queryKey: ['services'] });
        
        const transformedService = transformToService(newService);
        return transformedService;

      } catch (error) {
        console.error('Error en creación de servicio:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Servicio creado exitosamente');
    },
    onError: createMutationErrorHandler({
      title: 'Error al Crear Servicio',
      context: 'useServiceManager - createService'
    })
  });

  // ACTUALIZAR SERVICIO
  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, serviceData }: { 
      id: string; 
      serviceData: Partial<ServiceFormData> & { purchaseOrderNumber?: string } 
    }): Promise<Service> => {
      // Transformar datos para Supabase con validación de fechas y UUIDs
      console.log('🔧 Datos de servicio recibidos en useServiceManager:', {
        id: id,
        keys: Object.keys(serviceData),
        quoteNumber: serviceData.quoteNumber,
        purchaseOrder: serviceData.purchaseOrder
      });

      // 🚀 DETECTAR ACTUALIZACIÓN PARCIAL (batch update)
      const isPartialUpdate = Object.keys(serviceData).length <= 4 && 
                            (serviceData.quoteNumber !== undefined || serviceData.purchaseOrder !== undefined || serviceData.purchaseOrderNumber !== undefined || serviceData.status !== undefined) &&
                            !serviceData.requestDate && !serviceData.serviceDate;

      console.log('📊 Update type detection:', { isPartialUpdate, fieldsCount: Object.keys(serviceData).length });

      let transformedData: any = {};

      if (isPartialUpdate) {
        // ✅ ACTUALIZACIÓN PARCIAL - Solo procesar campos específicos enviados
        console.log('🎯 Processing PARTIAL update - only specific fields');
        
        if (serviceData.quoteNumber !== undefined) {
          transformedData.quote_number = serviceData.quoteNumber;
        }
        if (serviceData.purchaseOrder !== undefined) {
          transformedData.purchase_order = serviceData.purchaseOrder;
        }
        if (serviceData.purchaseOrderNumber !== undefined) {
          transformedData.purchase_order_number = serviceData.purchaseOrderNumber;
        }
        if (serviceData.status !== undefined) {
          transformedData.status = serviceData.status;
          console.log('✅ useServiceManager - Procesando campo status:', serviceData.status);
        }
      } else {
        // ✅ ACTUALIZACIÓN COMPLETA - Procesar todos los campos con validación
        console.log('🔄 Processing FULL update - all fields with validation');
        
        transformedData = {
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
          // ✅ FIX: Validar UUID fields - convertir cadenas vacías a null SOLO si están presentes
          ...(serviceData.client !== undefined && {
            client_id: serviceData.client && serviceData.client.trim() !== '' 
              ? serviceData.client 
              : null
          }),
          ...(serviceData.purchaseOrder !== undefined && {
            purchase_order: serviceData.purchaseOrder
          }),
          ...(serviceData.quoteNumber !== undefined && {
            quote_number: serviceData.quoteNumber
          }),
          ...(serviceData.serviceType !== undefined && {
            service_type_id: serviceData.serviceType && serviceData.serviceType.trim() !== '' 
              ? serviceData.serviceType 
              : null
          }),
          ...(serviceData.crane !== undefined && {
            crane_id: serviceData.crane && serviceData.crane.trim() !== '' 
              ? serviceData.crane 
              : null
          }),
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
          ...(serviceData.hasExcess !== undefined && {
            has_excess: serviceData.hasExcess
          }),
          ...(serviceData.clientCoveredAmount !== undefined && {
            client_covered_amount: serviceData.clientCoveredAmount
          }),
          ...(serviceData.excessAmount !== undefined && {
            excess_amount: serviceData.excessAmount || null
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
          })
        };
      }

      // Remover campos que no van en la tabla services
      delete transformedData.client;
      delete transformedData.purchaseOrder;
      delete transformedData.quoteNumber;
      delete transformedData.serviceType;
      delete transformedData.crane;
      delete transformedData.vehicleBrand;
      delete transformedData.vehicleModel;
      delete transformedData.licensePlate;
      delete transformedData.hasExcess;
      delete transformedData.clientCoveredAmount;
      delete transformedData.excessAmount;
      delete transformedData.requestDate;
      delete transformedData.serviceDate;
      // Remove custody camelCase fields after transformation
      delete transformedData.custodyMode;
      delete transformedData.custodyDays;
      delete transformedData.custodyDailyRate;
      delete transformedData.custodyStartDate;
      delete transformedData.custodyEndDate;
      delete transformedData.custodyVehicleType;
      delete transformedData.custodyDiscountPercentage;
      delete transformedData.custodyTotalAmount;
      delete transformedData.custodyNotes;

      // ✅ MODIFICADO: Handle service costs (gastos) update con prevención de duplicación
      if (serviceData.costDetails && Array.isArray(serviceData.costDetails)) {
      // ✅ NUEVO: Solo procesar costos si viene del formulario principal
      const isFromMainForm = (serviceData as any)._source === 'main_form' || (serviceData as any)._processCosts === true;
      const isFromServiceModal = (serviceData as any)._source === 'service_modal';
      
      if (isFromMainForm) {
        console.log('[updateService] Processing service costs from main form:', serviceData.costDetails);
        
        const commissionCategoryId = '440296d4-09c2-4f3a-b02b-835f861df4c4';
        
        // Delete existing costs for this service (exclude commissions)
        const { error: deleteCostsError } = await supabase
          .from('costs')
          .delete()
          .eq('service_id', id)
          .neq('category_id', commissionCategoryId);
      
        if (deleteCostsError) {
          console.error('[updateService] Error deleting existing service costs:', deleteCostsError);
        } else {
          console.log('[updateService] Existing service costs (non-commission) deleted');
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
            date: currentService?.service_date || new Date().toISOString().split('T')[0],
            description: cost.description,
            subcategory: cost.subcategory || null,
            notes: cost.notes || 'Costo actualizado desde formulario de servicio',
            crane_id: currentService?.crane_id,
            created_by: null
          }));
      
          console.log('[updateService] Inserting updated service costs:', serviceCosts);
      
          const { error: insertCostsError } = await supabase
            .from('costs')
            .insert(serviceCosts);
      
          if (insertCostsError) {
            console.error('[updateService] Error inserting updated service costs:', insertCostsError);
          } else {
            console.log('[updateService] Service costs updated successfully');
          }
        }
      } else if (isFromServiceModal) {
        console.log('[updateService] Skipping cost processing - handled by ServiceDetailsModal components');
      } else {
        console.log('[updateService] Skipping cost processing - no source flag or not from main form');
      }
      }

      // ✅ NEW: Handle operators update
      if (serviceData.operators && Array.isArray(serviceData.operators)) {
        console.log('[updateService] Updating service operators:', serviceData.operators);
        
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
        console.log('🚀 [SMART SYNC] Starting intelligent commission detection for service:', id);
        
        const { toCreate, toUpdate, toDelete } = await detectExistingCommissions(id, serviceData.operators);
        
        // Get current service data for foreign keys
        const { data: currentService } = await supabase
          .from('services')
          .select('folio, service_date, crane_id')
          .eq('id', id)
          .single();

        // 3. ELIMINAR solo las comisiones que ya no existen
        if (toDelete.length > 0) {
          console.log('🗑️ [SMART SYNC] Deleting obsolete commissions:', toDelete.map(c => c.id));
          
          const { error: deleteCommissionsError } = await supabase
            .from('costs')
            .delete()
            .in('id', toDelete.map(c => c.id));

          if (deleteCommissionsError) {
            console.error('[SMART SYNC] Error deleting obsolete commissions:', deleteCommissionsError);
          } else {
            console.log('✅ [SMART SYNC] Obsolete commission costs deleted successfully');
          }
        }

        // 4. ACTUALIZAR comisiones existentes que cambiaron
        if (toUpdate.length > 0) {
          console.log('✏️ [SMART SYNC] Updating existing commissions:', toUpdate.length);
          
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
          console.log('✅ [SMART SYNC] Commission costs updated successfully');
        }

        // 5. CREAR solo las nuevas comisiones
        if (toCreate.length > 0) {
          console.log('➕ [SMART SYNC] Creating new commissions:', toCreate.length);
          
          const newCommissionCosts = toCreate.map(operator => ({
            amount: operator.amount,
            category_id: commissionCategoryId,
            service_id: id,
            service_folio: currentService?.folio || 'Unknown',
            date: currentService?.service_date || new Date().toISOString().split('T')[0],
            description: `Comisión operador - Servicio ${currentService?.folio || id}`,
            subcategory: 'Comisiones',
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
          } else {
            console.log('✅ [SMART SYNC] New commission costs created successfully');
          }
        }
        
        console.log('🎉 [SMART SYNC] Intelligent commission sync completed successfully');
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
          client:clients(*),
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
            operator:operators(*)
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      // Invalidar todas las queries relacionadas para asegurar datos actualizados
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services'] }),
        queryClient.invalidateQueries({ queryKey: ['enhanced-service-details', id] }),
        queryClient.invalidateQueries({ queryKey: ['service-costs', id] }),
        queryClient.invalidateQueries({ queryKey: ['costs'] }),
        queryClient.invalidateQueries({ queryKey: ['commissions'] })
      ]);
      
      return transformToService(updatedService);
    },
    onSuccess: () => {
      toast.success('Servicio actualizado exitosamente');
    },
    onError: (error) => {
      console.error('Error actualizando servicio:', error);
    }
  });

  // ELIMINAR SERVICIO
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) => {
      console.error('Error eliminando servicio:', error);
    }
  });

  // Estados de carga unificados
  const isLoading = createServiceMutation.isPending || updateServiceMutation.isPending || deleteServiceMutation.isPending;

  // Funciones públicas
  const createService = async (serviceData: ServiceFormData): Promise<Service> => {
    return createServiceMutation.mutateAsync(serviceData);
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