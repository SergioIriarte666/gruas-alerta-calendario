
import { supabase } from '@/integrations/supabase/client';
import { exportServiceReport } from './reportExporter';
import { Service } from '@/types';
import { Settings } from '@/types/settings';
import { ReportColumnsConfig, defaultReportColumnConfig } from '@/types/reportColumnConfig';
import { createLogger } from "@/lib/logger";


const logger = createLogger("serviceReportGenerator");
interface GenerateReportArgs {
  format: 'pdf' | 'excel';
  downloadWindow?: Window | null;
  filters: {
    dateFrom: string;
    dateTo: string;
    clientId?: string;
  }
}

const fetchServicesForReport = async (filters: GenerateReportArgs['filters']): Promise<Service[]> => {
  const { dateFrom, dateTo, clientId } = filters;
  
  logger.debug('Filtering services by date range:', { dateFrom, dateTo });
  
  const selectFields = `
      id,
      folio,
      service_date,
      start_time,
      end_time,
      crane_mileage,
      origin,
      destination,
      status,
      value,
      custody_total_amount,
      custody_start_date,
      custody_end_date,
      custody_days,
      custody_vehicle_type,
      custody_daily_rate,
      custody_rate_type,
      has_excess,
      client_covered_amount,
      excess_amount,
      third_party_client_id,
      vehicle_brand,
      vehicle_model,
      license_plate,
      observations,
      insured_name,
      quote_number,
      purchase_order,
      invoice_folio,
      invoice_numero_fiscal,
      client:clients!services_client_id_fkey(
        id,
        name,
        rut
      ),
      thirdPartyClient:clients!services_third_party_client_id_fkey(
        id,
        name,
        rut
      ),
      crane:cranes(
        id,
        license_plate,
        brand,
        model
      ),
      operator:operators(
        id,
        name
      ),
      serviceType:service_types(
        id,
        name
      )
    `;

  // Query 1: services whose service_date falls in range
  let query1 = supabase
    .from('services')
    .select(selectFields)
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo);

  // Query 2: services whose custody period overlaps with the date range
  // (service_date is before dateFrom but custody extends into the range)
  let query2 = supabase
    .from('services')
    .select(selectFields)
    .lt('service_date', dateFrom)
    .gte('custody_end_date', dateFrom);

  if (clientId) {
    query1 = query1.eq('client_id', clientId);
    query2 = query2.eq('client_id', clientId);
  }

  const [result1, result2] = await Promise.all([
    query1.order('service_date', { ascending: true }),
    query2.order('service_date', { ascending: true }),
  ]);

  if (result1.error) {
    logger.error('Error fetching services for report:', result1.error);
    throw new Error('Could not fetch services for the report.');
  }
  if (result2.error) {
    logger.error('Error fetching custody-overlap services:', result2.error);
  }

  // Merge and deduplicate by id
  const allData = [...(result2.data || []), ...(result1.data || [])];
  const seen = new Set<string>();
  const data = allData.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  
  logger.debug(`Found ${data.length} services (${result1.data?.length || 0} by date + ${result2.data?.length || 0} by custody overlap)`);
  
  const formattedServices: Service[] = (data || []).map((s: any) => ({
    ...s,
    serviceDate: s.service_date,
    startTime: s.start_time,
    endTime: s.end_time,
    craneMileage: s.crane_mileage,
    hasExcess: s.has_excess,
    clientCoveredAmount: s.client_covered_amount,
    excessAmount: s.excess_amount,
    thirdPartyClientId: s.third_party_client_id,
    thirdPartyClient: s.thirdPartyClient || null,
    custodyTotalAmount: s.custody_total_amount || 0,
    custodyStartDate: s.custody_start_date || null,
    custodyEndDate: s.custody_end_date || null,
    custodyDays: s.custody_days || 0,
    custodyVehicleType: s.custody_vehicle_type || '',
    custodyDailyRate: s.custody_daily_rate || 0,
    custodyRateType: s.custody_rate_type || 'daily',
    vehicleBrand: s.vehicle_brand,
    vehicleModel: s.vehicle_model,
    licensePlate: s.license_plate,
    insuredName: s.insured_name,
    quoteNumber: s.quote_number || '',
    purchaseOrder: s.purchase_order || '',
    invoiceFolio: s.invoice_folio || '',
    invoiceNumeroFiscal: s.invoice_numero_fiscal || '',
    client: s.client,
    crane: s.crane ? {
      ...s.crane,
      licensePlate: s.crane.license_plate
    } : { id: '', licensePlate: 'N/A', brand: '', model: '' },
    operator: s.operator || { id: '', name: 'Sin operador' },
    serviceType: s.serviceType || { id: '', name: 'N/A' }
  }));

  return formattedServices;
}

const fetchSettings = async (): Promise<Settings> => {
    const { data, error } = await supabase
        .from('company_data')
        .select('*')
        .maybeSingle();
        
    if (error) {
        logger.error('Error fetching company settings:', error);
        throw new Error('Could not fetch company settings.');
    }
    if (!data) {
      return {
        company: { name: 'Mi Empresa', taxId: '', address: '', phone: '', email: '', folioFormat: 'SRV-{number}'},
        system: { autoBackup: true, backupFrequency: 'daily', dataRetention: 12, maintenanceMode: false },
        user: { 
          theme: 'dark', 
          language: 'es', 
          timezone: 'America/Santiago',
          useSystemTimezone: true,
          notifications: true,
          dateFormat: 'DD/MM/YYYY', 
          currency: 'CLP' 
        },
        notifications: { emailNotifications: true, serviceReminders: true, invoiceAlerts: true, overdueNotifications: true, systemUpdates: false }
      }
    }
    return {
      company: {
        name: data.business_name,
        taxId: data.rut,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo_url || undefined,
        folioFormat: data.folio_format || 'SRV-{number}',
      },
      system: {
        autoBackup: false,
        backupFrequency: 'daily',
        dataRetention: 12,
        maintenanceMode: false,
      },
      user: {
        theme: 'dark',
        language: 'es',
        timezone: 'America/Santiago',
        useSystemTimezone: true,
        notifications: true,
        dateFormat: 'DD/MM/YYYY',
        currency: 'CLP',
      },
      notifications: {
        emailNotifications: false,
        serviceReminders: false,
        invoiceAlerts: false,
        overdueNotifications: false,
        systemUpdates: false,
      }
    };
}

const fetchClientName = async (clientId: string): Promise<string> => {
    const { data, error } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();

    if (error) {
        logger.error('Error fetching client name:', error);
        return 'N/A';
    }
    return data.name;
}

const fetchReportColumnConfig = async (): Promise<ReportColumnsConfig> => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('report_column_config')
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('Error fetching report column config:', error);
      return defaultReportColumnConfig;
    }

    if (data?.report_column_config) {
      return data.report_column_config as unknown as ReportColumnsConfig;
    }
    
    return defaultReportColumnConfig;
  } catch (e) {
    logger.warn('Error fetching report column config:', e);
    return defaultReportColumnConfig;
  }
};

export const generateServiceReport = async ({ format, filters, downloadWindow }: GenerateReportArgs) => {
  try {
    const services = await fetchServicesForReport(filters);
    const settings = await fetchSettings();
    const reportColumnConfig = await fetchReportColumnConfig();
    
    let clientName: string | undefined;
    if (filters.clientId) {
        clientName = await fetchClientName(filters.clientId);
    }

    logger.debug('📄 [SERVICE-REPORT] Logo URL de settings:', settings.company.logo);
    logger.debug('📄 [SERVICE-REPORT] Report column config loaded');

    await exportServiceReport({
      format,
      services,
      settings,
      logoUrl: settings.company.logo,
      reportColumnConfig,
      downloadWindow,
      appliedFilters: {
        dateRange: {
          from: filters.dateFrom,
          to: filters.dateTo,
        },
        client: clientName || (filters.clientId ? 'Desconocido' : 'Todos'),
      },
    });
  } catch (error) {
    logger.error("Failed to generate service report:", error);
    throw error;
  }
};
