
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { useServiceTransformer } from './useServiceTransformer';
import { useQuery } from '@tanstack/react-query';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceFetcher');

// Only select the columns actually used by the app
const SERVICE_SELECT = `
  id, folio, request_date, service_date, client_id, purchase_order, purchase_order_number, quote_number,
  vehicle_brand, vehicle_model, license_plate, origin, destination,
  service_type_id, value, crane_id, operator_id, operator_commission,
  status, observations, has_excess, client_covered_amount, excess_amount,
  invoice_folio, invoice_numero_fiscal,
  company_rut, company_name,
  custody_mode, custody_days, custody_daily_rate, custody_start_date, custody_end_date,
  custody_vehicle_type, custody_discount_percentage, custody_total_amount, custody_notes, custody_rate_type,
  start_time, end_time, crane_mileage, insured_name,
  outsourced_provider_id, outsourced_cost, outsourced_notes,
  created_by, created_at, updated_at,
  client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department, is_active),
  third_party_client:clients!services_third_party_client_id_fkey(id, name),
  cranes(id, license_plate, brand, model, type, is_active, owner_company_rut, owner_company_name),
  operators(id, name, rut, phone, license_number, is_active, exam_expiry),
  service_types(id, name, description, is_active, base_price, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required),
  creator:profiles!services_created_by_fkey(id, full_name, email)
`;

const PAGE_SIZE = 1000;

const fetchAllPages = async (selectQuery: string, orderField: string = 'created_at'): Promise<any[]> => {
  const allData: any[] = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('services')
      .select(selectQuery)
      .order(orderField, { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  
  return allData;
};

const fetchServicesFromDB = async (transformFn: (data: any[]) => Service[]): Promise<Service[]> => {
  try {
    const data = await fetchAllPages(SERVICE_SELECT);
    if (!data.length) return [];
    return transformFn(data);
  } catch (error) {
    logger.error('Error fetching services (main query):', error);
    logger.warn('[SERVICE_FETCHER] FALLING BACK to SELECT * - embedded relations will be missing!');
    try {
      const simpleData = await fetchAllPages('*');
      if (!simpleData.length) return [];
      return transformFn(simpleData);
    } catch (fallbackError) {
      logger.error('Fallback query also failed:', fallbackError);
      return [];
    }
  }
};

export const useServiceFetcher = () => {
  const { transformRawServiceData } = useServiceTransformer();

  const { data: services = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: () => fetchServicesFromDB(transformRawServiceData),
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 5 * 60 * 1000,
  });

  return {
    services,
    loading,
    refetch,
    fetchServices: async () => {
      const result = await refetch();
      return result.data ?? [];
    }
  };
};
