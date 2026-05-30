import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CompanyDataFetcher');

interface CompanyData {
  businessName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

const DEFAULT_COMPANY: CompanyData = {
  businessName: 'Grúas 5 Norte',
  rut: '76.769.841-0',
  address: 'Panamericana Norte Km. 841, Copiapó',
  phone: '+56 9 62380627',
  email: 'asistencia@gruas5norte.cl',
};

export const fetchCompanyData = async (): Promise<CompanyData> => {
  try {
    // maybeSingle() no lanza error si no hay filas o si RLS bloquea (406)
    const { data, error } = await supabase
      .from('company_data')
      .select('business_name, rut, address, phone, email, logo_url')
      .maybeSingle();

    if (error || !data) {
      logger.warn('company_data no disponible, usando defaults:', error?.code);
      return DEFAULT_COMPANY;
    }

    return {
      businessName: data.business_name || DEFAULT_COMPANY.businessName,
      rut: data.rut || DEFAULT_COMPANY.rut,
      address: data.address || DEFAULT_COMPANY.address,
      phone: data.phone || DEFAULT_COMPANY.phone,
      email: data.email || DEFAULT_COMPANY.email,
      logoUrl: data.logo_url || undefined,
    };
  } catch {
    return DEFAULT_COMPANY;
  }
};
