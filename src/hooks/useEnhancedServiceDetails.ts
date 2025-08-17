import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { EnhancedService, ServiceOperator } from '@/types/serviceDetails';
import { Cost } from '@/types/costs';

/**
 * Hook global para cargar datos completos de un servicio incluyendo:
 * - Datos básicos del servicio
 * - Todos los operadores (principal + adicionales como comisiones)
 * - Todos los costos detallados (excluyendo comisiones de operadores)
 * - Totales calculados
 */

const fetchEnhancedServiceDetails = async (serviceId: string): Promise<EnhancedService | null> => {
  if (!serviceId) {
    console.log('❌ [ENHANCED_SERVICE] No serviceId provided');
    return null;
  }

  console.log('🔍 [ENHANCED_SERVICE] Fetching complete service data for:', serviceId);

  // 1. Obtener datos básicos del servicio con relaciones (incluyendo campos de custodia)
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .select(`
      *,
      clients!inner(id, name, rut, phone, email, address, is_active, created_at, updated_at),
      cranes(id, license_plate, brand, model, type, is_active, circulation_permit_expiry, insurance_expiry, technical_review_expiry, created_at, updated_at),
      operators(id, name, rut, phone, license_number, is_active, exam_expiry, created_at, updated_at),
      service_types!inner(id, name, description, is_active, base_price, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
    `)
    .eq('id', serviceId)
    .single();

  if (serviceError) {
    console.error('❌ [ENHANCED_SERVICE] Error fetching service:', serviceError);
    throw new Error('No se pudo cargar el servicio');
  }

  if (!serviceData) return null;

  // 2. Obtener todos los costos del servicio
  const { data: costsData, error: costsError } = await supabase
    .from('costs')
    .select(`
      *,
      cost_categories(id, name),
      cranes(id, license_plate, brand, model),
      operators(id, name, rut)
    `)
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false });

  if (costsError) {
    console.error('❌ [ENHANCED_SERVICE] Error fetching costs:', costsError);
    throw new Error('No se pudieron cargar los costos del servicio');
  }

  // 3. Separar costos de comisiones de operadores vs otros costos
  const commissionCosts = costsData?.filter(cost => 
    cost.subcategory === 'Comisiones' || 
    cost.description?.toLowerCase().includes('comisión') ||
    cost.description?.toLowerCase().includes('operador')
  ) || [];
  
  const serviceCosts = costsData?.filter(cost => 
    cost.subcategory !== 'Comisiones' && 
    !cost.description?.toLowerCase().includes('comisión') &&
    !cost.description?.toLowerCase().includes('operador')
  ) || [];

  console.log('📊 [ENHANCED_SERVICE] Commission costs found:', commissionCosts.length);
  console.log('📊 [ENHANCED_SERVICE] Service costs found:', serviceCosts.length);

  // 4. Construir array de operadores evitando duplicaciones
  const operators: ServiceOperator[] = [];
  const processedOperatorIds = new Set<string>();
  
  // Agregar operador principal si existe
  console.log('🔍 [ENHANCED_SERVICE] Service data operators:', serviceData.operators);
  console.log('🔍 [ENHANCED_SERVICE] Service data operator_id:', serviceData.operator_id);
  
  if (serviceData.operators && serviceData.operator_id) {
    operators.push({
      id: 'main-operator',
      operatorId: serviceData.operator_id,
      operator: {
        id: serviceData.operators.id,
        name: serviceData.operators.name,
        rut: serviceData.operators.rut,
        phone: serviceData.operators.phone,
        email: undefined,
        licenseNumber: serviceData.operators.license_number,
        examExpiry: serviceData.operators.exam_expiry,
        isActive: serviceData.operators.is_active,
        createdAt: serviceData.operators.created_at,
        updatedAt: serviceData.operators.updated_at
      },
      commission: serviceData.operator_commission || 0,
      role: 'Principal',
      hours: 8
    });
    
    // Marcar este operador como procesado para evitar duplicados
    processedOperatorIds.add(serviceData.operator_id);
  }

  // Agregar operadores adicionales desde costos de comisiones (solo si no están ya procesados)
  commissionCosts.forEach((cost, index) => {
    if (cost.operator_id && cost.operators && !processedOperatorIds.has(cost.operator_id)) {
      operators.push({
        id: `additional-${cost.id}`,
        operatorId: cost.operator_id,
        operator: {
          id: cost.operators.id,
          name: cost.operators.name,
          rut: cost.operators.rut,
          phone: '', // No disponible en la query de costos
          email: undefined,
          licenseNumber: '', // No disponible en la query de costos
          examExpiry: '', // No disponible en la query de costos
          isActive: true, // Asumimos que está activo
          createdAt: '', // No disponible en la query de costos
          updatedAt: '' // No disponible en la query de costos
        },
        commission: cost.amount || 0,
        role: 'Adicional',
        hours: cost.notes?.match(/(\d+)\s*horas?/i)?.[1] ? parseInt(cost.notes.match(/(\d+)\s*horas?/i)![1]) : undefined
      });
      
      // Marcar este operador como procesado
      processedOperatorIds.add(cost.operator_id);
    }
  });

  // 5. Calcular totales
  const totalCommissions = operators.reduce((sum, op) => sum + (op.commission || 0), 0);
  const totalCosts = serviceCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);

  // 6. Construir servicio mejorado
  const enhancedService: EnhancedService = {
    id: serviceData.id,
    folio: serviceData.folio,
    requestDate: serviceData.request_date,
    serviceDate: serviceData.service_date,
    client: {
      id: serviceData.clients.id,
      name: serviceData.clients.name,
      rut: serviceData.clients.rut,
      phone: serviceData.clients.phone,
      email: serviceData.clients.email,
      address: serviceData.clients.address,
      department: '', // No disponible en la query
      contactName: undefined,
      isActive: serviceData.clients.is_active,
      createdAt: serviceData.clients.created_at,
      updatedAt: serviceData.clients.updated_at
    },
    purchaseOrder: serviceData.purchase_order,
    vehicleBrand: serviceData.vehicle_brand,
    vehicleModel: serviceData.vehicle_model,
    licensePlate: serviceData.license_plate,
    origin: serviceData.origin,
    destination: serviceData.destination,
    serviceType: {
      id: serviceData.service_types.id,
      name: serviceData.service_types.name,
      description: serviceData.service_types.description,
      basePrice: serviceData.service_types.base_price,
      isActive: serviceData.service_types.is_active,
      vehicleInfoOptional: serviceData.service_types.vehicle_info_optional,
      purchaseOrderRequired: serviceData.service_types.purchase_order_required,
      originRequired: serviceData.service_types.origin_required,
      destinationRequired: serviceData.service_types.destination_required,
      craneRequired: serviceData.service_types.crane_required,
      operatorRequired: serviceData.service_types.operator_required,
      vehicleBrandRequired: serviceData.service_types.vehicle_brand_required,
      vehicleModelRequired: serviceData.service_types.vehicle_model_required,
      licensePlateRequired: serviceData.service_types.license_plate_required,
      createdAt: serviceData.service_types.created_at,
      updatedAt: serviceData.service_types.updated_at
    },
    value: serviceData.value,
    crane: serviceData.cranes ? {
      id: serviceData.cranes.id,
      licensePlate: serviceData.cranes.license_plate,
      brand: serviceData.cranes.brand,
      model: serviceData.cranes.model,
      type: serviceData.cranes.type,
      circulationPermitExpiry: serviceData.cranes.circulation_permit_expiry,
      insuranceExpiry: serviceData.cranes.insurance_expiry,
      technicalReviewExpiry: serviceData.cranes.technical_review_expiry,
      isActive: serviceData.cranes.is_active,
      createdAt: serviceData.cranes.created_at,
      updatedAt: serviceData.cranes.updated_at
    } : null,
    status: serviceData.status,
    observations: serviceData.observations,
    hasExcess: serviceData.has_excess,
    clientCoveredAmount: serviceData.client_covered_amount,
    excessAmount: serviceData.excess_amount,
    invoiceFolio: serviceData.invoice_folio,
    invoiceNumeroFiscal: serviceData.invoice_numero_fiscal,
    // Campos de custodia
    custodyMode: serviceData.custody_mode as 'manual' | 'calendar' | 'none' | undefined,
    custodyDays: serviceData.custody_days,
    custodyDailyRate: serviceData.custody_daily_rate,
    custodyStartDate: serviceData.custody_start_date,
    custodyEndDate: serviceData.custody_end_date,
    custodyVehicleType: serviceData.custody_vehicle_type,
    custodyDiscountPercentage: serviceData.custody_discount_percentage,
    custodyTotalAmount: serviceData.custody_total_amount,
    custodyNotes: serviceData.custody_notes,
    createdAt: serviceData.created_at,
    updatedAt: serviceData.updated_at,
    // Datos mejorados
    operators,
    serviceCosts: serviceCosts as Cost[],
    totalCosts,
    totalCommissions
  };

  console.log('✅ [ENHANCED_SERVICE] Enhanced service created:', {
    folio: enhancedService.folio,
    operatorsCount: operators.length,
    serviceCostsCount: serviceCosts.length,
    totalCommissions,
    totalCosts
  });

  return enhancedService;
};

export const useEnhancedServiceDetails = (serviceId: string | null) => {
  const { data, isLoading, error, isSuccess, refetch } = useQuery({
    queryKey: ['enhanced-service-details', serviceId],
    queryFn: () => fetchEnhancedServiceDetails(serviceId!),
    enabled: !!serviceId,
    retry: (failureCount, error) => {
      console.log(`Enhanced service details query retry attempt ${failureCount}:`, error.message);
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 30000, // 30 segundos
    gcTime: 300000 // 5 minutos
  });

  return { 
    data, 
    isLoading, 
    error, 
    isSuccess, 
    refetch,
    enhancedService: data 
  };
};