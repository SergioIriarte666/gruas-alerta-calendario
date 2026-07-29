import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedService, ServiceOperator } from '@/types/serviceDetails';
import { Cost } from '@/types/costs';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useEnhancedServiceDetails");
/**
 * Hook global para cargar datos completos de un servicio incluyendo:
 * - Datos básicos del servicio
 * - Todos los operadores (principal + adicionales como comisiones)
 * - Todos los costos detallados (excluyendo comisiones de operadores)
 * - Totales calculados
 */

const fetchEnhancedServiceDetails = async (serviceId: string): Promise<EnhancedService | null> => {
  if (!serviceId) {
    logger.debug('❌ [ENHANCED_SERVICE] No serviceId provided');
    return null;
  }

  logger.debug('🔍 [ENHANCED_SERVICE] Fetching complete service data for:', serviceId);

  // 1. Obtener datos básicos del servicio con relaciones (incluyendo campos de custodia y proveedor tercerizado)
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .select(`
      *, quote_number,
      client:clients!services_client_id_fkey(id, name, rut, phone, email, address, contact_name, department, is_active, created_at, updated_at),
      third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, contact_name, department, is_active, created_at, updated_at),
      cranes(id, license_plate, brand, model, type, is_active, circulation_permit_expiry, insurance_expiry, technical_review_expiry, created_at, updated_at),
      operators(id, name, rut, phone, license_number, is_active, exam_expiry, operator_type, department, position, commission_exempt, created_at, updated_at),
      service_types!inner(id, name, description, is_active, base_price, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at, is_outsourced),
      creator:profiles!services_created_by_fkey(id, full_name, email),
      outsourced_provider:inventory_suppliers!services_outsourced_provider_id_fkey(id, name, rut, phone, email)
    `)
    .eq('id', serviceId)
    .single();

  if (serviceError) {
    logger.error('❌ [ENHANCED_SERVICE] Error fetching service:', serviceError);
    throw new Error('No se pudo cargar el servicio');
  }

  if (!serviceData) return null;

  logger.debug('🔍 [ENHANCED_SERVICE] Service creator data:', {
    created_by: serviceData.created_by,
    creator: serviceData.creator,
    creator_full_name: serviceData.creator?.full_name,
    creator_email: serviceData.creator?.email
  });

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
    logger.error('❌ [ENHANCED_SERVICE] Error fetching costs:', costsError);
    throw new Error('No se pudieron cargar los costos del servicio');
  }

  // 2.5. Resolver factura desde vínculos relacionales (FUENTE DE VERDAD)
  let resolvedInvoiceFolio: string | null = null;
  let resolvedInvoiceNumeroFiscal: string | null = null;
  let resolvedClosureFolio: string | null = null;

  // Prioridad 1: vínculo directo invoice_services
  const { data: directInvoiceLink } = await supabase
    .from('invoice_services')
    .select('invoice_id, invoices(id, folio, numero_fiscal, status)')
    .eq('service_id', serviceId)
    .maybeSingle();

  if (directInvoiceLink?.invoices && (directInvoiceLink.invoices as any).status !== 'cancelled') {
    const inv = directInvoiceLink.invoices as any;
    resolvedInvoiceFolio = inv.folio;
    resolvedInvoiceNumeroFiscal = inv.numero_fiscal;
    logger.debug('🔗 [ENHANCED_SERVICE] Factura resuelta por vínculo directo:', inv.folio);
  }

  // Prioridad 2: vínculo por cierre (closure_services → invoice_closures → invoices)
  if (!resolvedInvoiceFolio) {
    const { data: closureLink } = await supabase
      .from('closure_services')
      .select('closure_id, service_closures(id, folio, status)')
      .eq('service_id', serviceId)
      .maybeSingle();

    if (closureLink?.service_closures) {
      const closure = closureLink.service_closures as any;
      resolvedClosureFolio = closure.folio;

      const { data: invoiceClosureLink } = await supabase
        .from('invoice_closures')
        .select('invoice_id, invoices(id, folio, numero_fiscal, status)')
        .eq('closure_id', closureLink.closure_id)
        .maybeSingle();

      if (invoiceClosureLink?.invoices && (invoiceClosureLink.invoices as any).status !== 'cancelled') {
        const inv = invoiceClosureLink.invoices as any;
        resolvedInvoiceFolio = inv.folio;
        resolvedInvoiceNumeroFiscal = inv.numero_fiscal;
        logger.debug('🔗 [ENHANCED_SERVICE] Factura resuelta por cierre:', inv.folio, 'via', closure.folio);
      }
    }
  }

  // Fallback: metadata del servicio (cache desnormalizada)
  if (!resolvedInvoiceFolio && serviceData.invoice_folio) {
    resolvedInvoiceFolio = serviceData.invoice_folio;
    resolvedInvoiceNumeroFiscal = serviceData.invoice_numero_fiscal;
    logger.debug('⚠️ [ENHANCED_SERVICE] Factura resuelta por metadata (fallback):', serviceData.invoice_folio);
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

  logger.debug('📊 [ENHANCED_SERVICE] Commission costs found:', commissionCosts.length);
  logger.debug('📊 [ENHANCED_SERVICE] Service costs found:', serviceCosts.length);

  // 4. Construir array de operadores desde service_resources (fuente de verdad)
  const operators: ServiceOperator[] = [];

  // Intentar leer desde service_resources primero
  const { data: resourcesData } = await supabase
    .from('service_resources')
    .select('id, operator_id, role, commission_amount, is_primary, operators(id, name, rut, phone, license_number, is_active, exam_expiry, operator_type, department, position, created_at, updated_at, commission_exempt)')
    .eq('service_id', serviceId)
    .eq('resource_type', 'operator');

  logger.debug('🔍 [ENHANCED_SERVICE] service_resources found:', resourcesData?.length || 0);

  if (resourcesData && resourcesData.length > 0) {
    // Fuente primaria: service_resources con asignaciones reales.
    // Un operador exento igual pertenece al servicio; solo su comisión debe ser 0.
    resourcesData.forEach((resource: any) => {
      if (resource.operator_id && resource.operators) {
        operators.push({
          id: resource.id,
          operatorId: resource.operator_id,
          operator: {
            id: resource.operators.id,
            name: resource.operators.name,
            rut: resource.operators.rut,
            phone: resource.operators.phone || '',
            operatorType: (resource.operators.operator_type as 'crane_operator' | 'administrative') || 'crane_operator',
            department: resource.operators.department || '',
            position: resource.operators.position || '',
            licenseNumber: resource.operators.license_number || '',
            examExpiry: resource.operators.exam_expiry || '',
            commissionExempt: resource.operators.commission_exempt ?? false,
            isActive: resource.operators.is_active ?? true,
            createdAt: resource.operators.created_at || '',
            updatedAt: resource.operators.updated_at || ''
          },
          commission: resource.operators.commission_exempt ? 0 : (resource.commission_amount || 0),
          role: resource.role || (resource.is_primary ? 'Principal' : 'Adicional'),
          hours: undefined
        });
      }
    });
    logger.debug('✅ [ENHANCED_SERVICE] Operators loaded from service_resources:', operators.map(o => ({ name: o.operator?.name, role: o.role, commission: o.commission })));
  } else {
    // Fallback para servicios legacy sin service_resources
    logger.debug('⚠️ [ENHANCED_SERVICE] No service_resources found, using legacy fallback');
    const processedOperatorIds = new Set<string>();

    if (serviceData.operators && serviceData.operator_id) {
      operators.push({
        id: 'main-operator',
        operatorId: serviceData.operator_id,
        operator: {
          id: serviceData.operators.id,
          name: serviceData.operators.name,
          rut: serviceData.operators.rut,
          phone: serviceData.operators.phone,
          operatorType: (serviceData.operators.operator_type as 'crane_operator' | 'administrative') || 'crane_operator',
          department: serviceData.operators.department,
          position: serviceData.operators.position,
          licenseNumber: serviceData.operators.license_number,
            examExpiry: serviceData.operators.exam_expiry,
            commissionExempt: serviceData.operators.commission_exempt ?? false,
          isActive: serviceData.operators.is_active,
          createdAt: serviceData.operators.created_at,
          updatedAt: serviceData.operators.updated_at
        },
          commission: serviceData.operators.commission_exempt ? 0 : (serviceData.operator_commission || 0),
        role: 'Principal',
        hours: 8
      });
      processedOperatorIds.add(serviceData.operator_id);
    }

    commissionCosts.forEach((cost) => {
      if (cost.operator_id && cost.operators && !processedOperatorIds.has(cost.operator_id) && (cost.amount || 0) > 0) {
        operators.push({
          id: `additional-${cost.id}`,
          operatorId: cost.operator_id,
          operator: {
            id: cost.operators.id,
            name: cost.operators.name,
            rut: cost.operators.rut,
            phone: '',
            operatorType: 'crane_operator',
            licenseNumber: '',
            examExpiry: '',
            isActive: true,
            createdAt: '',
            updatedAt: ''
          },
          commission: cost.amount || 0,
          role: 'Adicional',
          hours: undefined
        });
        processedOperatorIds.add(cost.operator_id);
      }
    });
  }

  // 5. Calcular totales
  const totalCommissions = operators.reduce((sum, op) => sum + (op.commission || 0), 0);
  const totalCosts = serviceCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);

  // 6. Construir servicio mejorado
  const enhancedService: EnhancedService = {
    id: serviceData.id,
    folio: serviceData.folio,
    requestDate: serviceData.request_date,
    serviceDate: serviceData.service_date,
    client: (serviceData.client || serviceData.third_party_client) ? {
      id: (serviceData.client || serviceData.third_party_client).id,
      name: (serviceData.client || serviceData.third_party_client).name,
      rut: (serviceData.client || serviceData.third_party_client).rut,
      phone: (serviceData.client || serviceData.third_party_client).phone,
      email: (serviceData.client || serviceData.third_party_client).email,
      address: (serviceData.client || serviceData.third_party_client).address,
      contactName: (serviceData.client || serviceData.third_party_client).contact_name || undefined,
      department: (serviceData.client || serviceData.third_party_client).department || '',
      isActive: (serviceData.client || serviceData.third_party_client).is_active,
      createdAt: (serviceData.client || serviceData.third_party_client).created_at,
      updatedAt: (serviceData.client || serviceData.third_party_client).updated_at
    } : null,
    purchaseOrder: serviceData.purchase_order,
    purchaseOrderNumber: serviceData.purchase_order_number || '',
    quoteNumber: serviceData.quote_number || '',
    vehicleBrand: serviceData.vehicle_brand,
    vehicleModel: serviceData.vehicle_model,
    licensePlate: serviceData.license_plate,
    startTime: serviceData.start_time || undefined,
    endTime: serviceData.end_time || undefined,
    craneMileage: serviceData.crane_mileage || undefined,
    origin: serviceData.origin,
    originLat: serviceData.origin_lat ?? null,
    originLng: serviceData.origin_lng ?? null,
    destination: serviceData.destination,
    destinationLat: serviceData.destination_lat ?? null,
    destinationLng: serviceData.destination_lng ?? null,
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
    thirdPartyClientId: serviceData.third_party_client_id || null,
    thirdPartyClientName: serviceData.third_party_client?.name || null,
    thirdPartyClientRut: serviceData.third_party_client?.rut || null,
    invoiceFolio: serviceData.invoice_folio,
    invoiceNumeroFiscal: serviceData.invoice_numero_fiscal,
    // Campos de custodia
    custodyMode: serviceData.custody_mode as 'manual' | 'calendar' | 'none' | undefined,
    custodyDays: serviceData.custody_days,
    custodyDailyRate: serviceData.custody_daily_rate,
    custodyRateType: serviceData.custody_rate_type,
    custodyStartDate: serviceData.custody_start_date,
    custodyEndDate: serviceData.custody_end_date,
    custodyVehicleType: serviceData.custody_vehicle_type,
    custodyDiscountPercentage: serviceData.custody_discount_percentage,
    custodyTotalAmount: serviceData.custody_total_amount,
    custodyNotes: serviceData.custody_notes,
    // Outsourced/Third-party service fields
    outsourcedProviderId: serviceData.outsourced_provider_id,
    outsourcedCost: serviceData.outsourced_cost,
    outsourcedNotes: serviceData.outsourced_notes,
    outsourcedProviderName: (serviceData as any).outsourced_provider?.name || null,
    // Contact person at service location
    contactPerson: serviceData.contact_person || undefined,
    contactPhone: serviceData.contact_phone || undefined,
    createdAt: serviceData.created_at,
    updatedAt: serviceData.updated_at,
    createdBy: serviceData.created_by || undefined,
    creatorName: serviceData.creator?.full_name || serviceData.creator?.email || undefined,
    // Datos mejorados
    operators,
    serviceCosts: serviceCosts as Cost[],
    totalCosts,
    totalCommissions,
    // Datos resueltos desde vínculos relacionales
    resolvedInvoiceFolio,
    resolvedInvoiceNumeroFiscal,
    resolvedClosureFolio
  };

  logger.debug('✅ [ENHANCED_SERVICE] Enhanced service created:', {
    folio: enhancedService.folio,
    purchaseOrder: enhancedService.purchaseOrder,
    purchaseOrderNumber: enhancedService.purchaseOrderNumber,
    operatorsCount: operators.length,
    serviceCostsCount: serviceCosts.length,
    totalCommissions,
    totalCosts,
    createdBy: enhancedService.createdBy,
    creatorName: enhancedService.creatorName
  });

  return enhancedService;
};

export const useEnhancedServiceDetails = (serviceId: string | null) => {
  const { data, isLoading, error, isSuccess, refetch } = useQuery({
    queryKey: ['enhanced-service-details', serviceId],
    queryFn: () => fetchEnhancedServiceDetails(serviceId!),
    enabled: !!serviceId,
    retry: (failureCount, error) => {
      logger.debug(`Enhanced service details query retry attempt ${failureCount}:`, error.message);
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
