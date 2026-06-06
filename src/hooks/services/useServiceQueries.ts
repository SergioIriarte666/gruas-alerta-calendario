import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceQueries');

const CLIENT_SELECT = `
  id,
  name,
  rut,
  phone,
  email,
  address,
  department,
  is_active,
  created_at,
  updated_at
`;

const CRANE_SELECT = `
  id,
  license_plate,
  brand,
  model,
  type,
  is_active,
  circulation_permit_expiry,
  insurance_expiry,
  technical_review_expiry,
  owner_company_rut,
  owner_company_name,
  created_at,
  updated_at
`;

const OPERATOR_SELECT = `
  id,
  name,
  rut,
  phone,
  operator_type,
  department,
  position,
  license_number,
  is_active,
  exam_expiry,
  created_at,
  updated_at
`;

const SERVICE_TYPE_SELECT = `
  id,
  name,
  description,
  base_price,
  is_active,
  vehicle_info_optional,
  purchase_order_required,
  origin_required,
  destination_required,
  crane_required,
  operator_required,
  vehicle_brand_required,
  vehicle_model_required,
  license_plate_required,
  created_at,
  updated_at
`;

const SERVICE_SELECT = `
  id,
  folio,
  request_date,
  service_date,
  purchase_order,
  purchase_order_number,
  quote_number,
  vehicle_brand,
  vehicle_model,
  license_plate,
  origin,
  destination,
  value,
  operator_commission,
  status,
  observations,
  has_excess,
  client_covered_amount,
  excess_amount,
  invoice_folio,
  invoice_numero_fiscal,
  insured_name,
  start_time,
  end_time,
  crane_mileage,
  outsourced_provider_id,
  outsourced_cost,
  outsourced_notes,
  custody_mode,
  custody_days,
  custody_daily_rate,
  custody_total_amount,
  custody_start_date,
  custody_end_date,
  custody_vehicle_type,
  created_by,
  created_at,
  updated_at
`;

const SERVICE_WITH_RELATIONS_SELECT = `
  ${SERVICE_SELECT},
  client:clients!services_client_id_fkey(${CLIENT_SELECT}),
  third_party_client:clients!services_third_party_client_id_fkey(${CLIENT_SELECT}),
  crane:cranes(${CRANE_SELECT}),
  operator:operators(${OPERATOR_SELECT}),
  serviceType:service_types(${SERVICE_TYPE_SELECT}),
  service_resources!service_resources_service_id_fkey(
    id,
    resource_type,
    operator_id,
    crane_id,
    is_primary,
    commission_amount,
    role,
    operator:operators(${OPERATOR_SELECT}),
    crane:cranes(${CRANE_SELECT})
  )
`;

// Función para transformar datos de Supabase a Service
const transformCrane = (raw: any) => {
  if (!raw) return null;
  return {
    id: raw.id,
    licensePlate: raw.license_plate,
    brand: raw.brand,
    model: raw.model,
    type: raw.type,
    isActive: raw.is_active,
    circulationPermitExpiry: raw.circulation_permit_expiry,
    insuranceExpiry: raw.insurance_expiry,
    technicalReviewExpiry: raw.technical_review_expiry,
    ownerCompanyRut: raw.owner_company_rut || undefined,
    ownerCompanyName: raw.owner_company_name || undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
};

const transformOperator = (raw: any) => {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    rut: raw.rut,
    phone: raw.phone,
    operatorType: raw.operator_type || 'crane_operator',
    department: raw.department,
    position: raw.position,
    licenseNumber: raw.license_number,
    isActive: raw.is_active,
    examExpiry: raw.exam_expiry,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
};

const transformClient = (raw: any) => {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    rut: raw.rut || '',
    phone: raw.phone || '',
    email: raw.email || '',
    address: raw.address || '',
    department: raw.department || '',
    isActive: raw.is_active ?? true,
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
  };
};

const transformServiceType = (raw: any) => {
  if (!raw) return { id: '', name: 'Tipo no disponible', description: '', basePrice: null, isActive: true, vehicleInfoOptional: false, purchaseOrderRequired: false, originRequired: true, destinationRequired: true, craneRequired: true, operatorRequired: true, vehicleBrandRequired: true, vehicleModelRequired: true, licensePlateRequired: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',
    basePrice: raw.base_price || null,
    isActive: raw.is_active ?? true,
    vehicleInfoOptional: raw.vehicle_info_optional || false,
    purchaseOrderRequired: raw.purchase_order_required || false,
    originRequired: raw.origin_required !== false,
    destinationRequired: raw.destination_required !== false,
    craneRequired: raw.crane_required !== false,
    operatorRequired: raw.operator_required !== false,
    vehicleBrandRequired: raw.vehicle_brand_required !== false,
    vehicleModelRequired: raw.vehicle_model_required !== false,
    licensePlateRequired: raw.license_plate_required !== false,
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
  };
};

// Normalize PostgREST embedded values (can be object, array, or null)
const normalizeEmbedded = (value: any): any => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const transformToService = (data: any): Service => {
  // Buscar operador y grúa principal en service_resources
  let primaryOperator = null;
  let primaryCrane = null;
  
  if (data.service_resources && data.service_resources.length > 0) {
    const primaryOperatorResource = data.service_resources.find(
      (r: any) => r.resource_type === 'operator' && r.is_primary
    ) || data.service_resources.find((r: any) => r.resource_type === 'operator');
    
    if (primaryOperatorResource?.operator) {
      primaryOperator = normalizeEmbedded(primaryOperatorResource.operator);
    }

    const primaryCraneResource = data.service_resources.find(
      (r: any) => r.resource_type === 'crane' && r.is_primary
    ) || data.service_resources.find((r: any) => r.resource_type === 'crane');
    
    if (primaryCraneResource?.crane) {
      primaryCrane = normalizeEmbedded(primaryCraneResource.crane);
    }
  }

  // Normalize and fallback: handle both aliased (crane) and table-name (cranes) keys
  const rawCrane = normalizeEmbedded(data.crane ?? data.cranes);
  const rawOperator = normalizeEmbedded(data.operator ?? data.operators);
  
  const finalOperator = transformOperator(primaryOperator || rawOperator);
  const finalCrane = transformCrane(primaryCrane || rawCrane);

  return {
    id: data.id,
    folio: data.folio,
    requestDate: data.request_date,
    serviceDate: data.service_date,
    client: transformClient(data.client || data.third_party_client),
    purchaseOrder: data.purchase_order || '',
    purchaseOrderNumber: data.purchase_order_number || '',
    quoteNumber: data.quote_number || '',
    vehicleBrand: data.vehicle_brand || '',
    vehicleModel: data.vehicle_model || '',
    licensePlate: data.license_plate || '',
    origin: data.origin || '',
    destination: data.destination || '',
    serviceType: transformServiceType(normalizeEmbedded(data.serviceType ?? data.service_types)),
    value: parseFloat(data.value) || 0,
    crane: finalCrane,
    operator: finalOperator,
    operatorCommission: parseFloat(data.operator_commission) || 0,
    status: data.status || 'pending',
    observations: data.observations || '',
    hasExcess: data.has_excess || false,
    clientCoveredAmount: data.client_covered_amount ?? null,
    excessAmount: data.excess_amount || 0,
    invoiceFolio: data.invoice_folio || undefined,
    invoiceNumeroFiscal: data.invoice_numero_fiscal || undefined,
    insuredName: data.insured_name || undefined,
    startTime: data.start_time || undefined,
    endTime: data.end_time || undefined,
    craneMileage: data.crane_mileage || undefined,
    outsourcedProviderId: data.outsourced_provider_id || undefined,
    outsourcedCost: data.outsourced_cost ?? undefined,
    outsourcedNotes: data.outsourced_notes || undefined,
    // Contact person at service location (independent of client master data)
    contactPerson: data.contact_person || undefined,
    contactPhone: data.contact_phone || undefined,
    custodyMode: data.custody_mode || 'none',
    custodyDays: data.custody_days || 0,
    custodyDailyRate: parseFloat(data.custody_daily_rate) || 0,
    custodyTotalAmount: parseFloat(data.custody_total_amount) || 0,
    custodyStartDate: data.custody_start_date || null,
    custodyEndDate: data.custody_end_date || null,
    custodyVehicleType: data.custody_vehicle_type || '',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by || undefined,
  };
};

// ⚡ HOOK SIMPLE PARA CONSULTAS DE SERVICIOS
export const useServiceQueries = () => {
  const useAllServices = () => {
    return useQuery({
      queryKey: ['services'],
      queryFn: async (): Promise<Service[]> => {
        
        const { data, error } = await supabase
          .from('services')
          .select(SERVICE_WITH_RELATIONS_SELECT)
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('❌ [QUERY] Error al obtener servicios:', error);
          throw new Error(error.message);
        }

        return data?.map(transformToService) || [];
      },
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  };

  // Fetch servicio por ID
  const useServiceById = (id: string) => {
    return useQuery({
      queryKey: ['services', id],
      queryFn: async (): Promise<Service | null> => {
        if (!id) return null;
        
        const { data, error } = await supabase
          .from('services')
          .select(SERVICE_WITH_RELATIONS_SELECT)
          .eq('id', id)
          .single();

        if (error) {
          logger.error('❌ [QUERY] Error al obtener servicio:', error);
          throw new Error(error.message);
        }

        return data ? transformToService(data) : null;
      },
      enabled: !!id,
      staleTime: 30000, // 30 segundos
      refetchOnWindowFocus: false,
    });
  };

  // Fetch servicios por operador
  const useServicesByOperator = (operatorId: string) => {
    return useQuery({
      queryKey: ['operatorServices', operatorId],
      queryFn: async (): Promise<Service[]> => {
        if (!operatorId) return [];
        
        const { data, error } = await supabase
          .from('services')
          .select(SERVICE_WITH_RELATIONS_SELECT)
          .eq('operator_id', operatorId)
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('❌ [QUERY] Error al obtener servicios del operador:', error);
          throw new Error(error.message);
        }

        return data?.map(transformToService) || [];
      },
      enabled: !!operatorId,
      staleTime: 30000, // 30 segundos
      refetchOnWindowFocus: false,
    });
  };

  const usePagedServices = (page: number, pageSize: number) => {
    return useQuery({
      queryKey: ['services', 'paged', page, pageSize],
      queryFn: async (): Promise<{ services: Service[]; total: number }> => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
          .from('services')
          .select(SERVICE_WITH_RELATIONS_SELECT, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          logger.error('❌ [QUERY] Error al obtener servicios paginados:', error);
          throw new Error(error.message);
        }

        const services = (data || []).map(transformToService);
        const total = typeof count === 'number' ? count : services.length;

        return { services, total };
      },
      enabled: page > 0 && pageSize > 0,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  };

  return {
    useAllServices,
    useServiceById,
    useServicesByOperator,
    usePagedServices
  };
};
