
import { supabase } from '@/integrations/supabase/client';
import { exportServiceReport } from './serviceReportExporter';
import { Service } from '@/types';
import { Settings } from '@/types/settings';
import { format } from 'date-fns';

interface GenerateReportArgs {
  format: 'pdf' | 'excel';
  filters: {
    dateFrom: Date;
    dateTo: Date;
    clientId?: string;
  }
}

const fetchServicesForReport = async (filters: GenerateReportArgs['filters']): Promise<Service[]> => {
  const { dateFrom, dateTo, clientId } = filters;
  
  let query = supabase
    .from('services')
    .select(`
      *,
      client:clients!inner(*),
      crane:cranes!inner(*),
      operator:operators!inner(*),
      serviceType:service_types!inner(*)
    `)
    .gte('service_date', format(dateFrom, 'yyyy-MM-dd'))
    .lte('service_date', format(dateTo, 'yyyy-MM-dd'));

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query.order('service_date', { ascending: true });

  if (error) {
    console.error('Error fetching services for report:', error);
    throw new Error('Could not fetch services for the report.');
  }
  
  const formattedServices: Service[] = data.map((s: any) => ({
    ...s,
    client: s.client,
    crane: s.crane,
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
        company: { name: 'Mi Empresa', taxId: '', address: '', phone: '', email: ''},
        system: { folioFormat: '', invoiceDueDays: 30, vatPercentage: 19, alertDays: 30 }
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
      },
      system: {
        folioFormat: data.folio_format || 'SRV-{number}',
        invoiceDueDays: data.invoice_due_days || 30,
        vatPercentage: data.vat_percentage || 19,
        alertDays: data.alert_days || 30,
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
        from: format(filters.dateFrom, 'yyyy-MM-dd'),
        to: format(filters.dateTo, 'yyyy-MM-dd'),
      },
      client: clientName || (filters.clientId ? 'Desconocido' : 'Todos'),
    },
  });
};
