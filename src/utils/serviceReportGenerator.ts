
import { supabase } from '@/integrations/supabase/client';
import { exportServiceReport } from './reportExporter';
import { Service } from '@/types';
import { Settings } from '@/types/settings';
import { format as formatDate } from 'date-fns';

interface GenerateReportArgs {
  format: 'pdf' | 'excel';
  filters: {
    dateFrom: string;
    dateTo: string;
    clientId?: string;
  }
}

const fetchServicesForReport = async (filters: GenerateReportArgs['filters']): Promise<Service[]> => {
  const { dateFrom, dateTo, clientId } = filters;
  
  console.log('Filtering services by date range:', { dateFrom, dateTo });
  
  let query = supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      origin,
      destination,
      status,
      value,
      has_excess,
      client_covered_amount,
      vehicle_brand,
      vehicle_model,
      license_plate,
      observations,
      client:clients!inner(
        id,
        name,
        rut
      ),
      crane:cranes!inner(
        id,
        license_plate,
        brand,
        model
      ),
      operator:operators!inner(
        id,
        name
      ),
      serviceType:service_types!inner(
        id,
        name
      )
    `)
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query.order('service_date', { ascending: true });

  if (error) {
    console.error('Error fetching services for report:', error);
    throw new Error('Could not fetch services for the report.');
  }
  
  console.log(`Found ${data?.length || 0} services`);
  
  const formattedServices: Service[] = (data || []).map((s: any) => ({
    ...s,
    serviceDate: s.service_date,
    hasExcess: s.has_excess,
    clientCoveredAmount: s.client_covered_amount,
    vehicleBrand: s.vehicle_brand,
    vehicleModel: s.vehicle_model,
    licensePlate: s.license_plate,
    client: s.client,
    crane: {
      ...s.crane,
      licensePlate: s.crane.license_plate
    },
    operator: s.operator,
    serviceType: s.serviceType
  }));

  return formattedServices;
}

const fetchSettings = async (): Promise<Settings> => {
    const { data, error } = await supabase
        .from('company_data')
        .select('*')
        .maybeSingle();
        
    if (error) {
        console.error('Error fetching company settings:', error);
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
        console.error('Error fetching client name:', error);
        return 'N/A';
    }
    return data.name;
}

export const generateServiceReport = async ({ format, filters }: GenerateReportArgs) => {
  try {
    const services = await fetchServicesForReport(filters);
    const settings = await fetchSettings();
    
    let clientName: string | undefined;
    if (filters.clientId) {
        clientName = await fetchClientName(filters.clientId);
    }

    await exportServiceReport({
      format,
      services,
      settings,
      appliedFilters: {
        dateRange: {
          from: filters.dateFrom,
          to: filters.dateTo,
        },
        client: clientName || (filters.clientId ? 'Desconocido' : 'Todos'),
      },
    });
  } catch (error) {
    console.error("Failed to generate service report:", error);
    // Here you could add a toast notification to inform the user
  }
};
