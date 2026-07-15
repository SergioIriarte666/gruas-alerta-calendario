import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CompanyProfileFetcher');

/**
 * Perfil de una entidad distinta de Grúas 5 Norte (tabla company_profiles).
 * NO confundir con company_data (fetchCompanyData), que es el membrete de G5N.
 */
export interface CompanyProfile {
  rut: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
}

/** Lee company_profiles por RUT. Devuelve null si no existe o RLS lo bloquea. */
export const fetchCompanyProfile = async (rut: string): Promise<CompanyProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('company_profiles')
      .select('rut, name, address, phone, email, logo_url')
      .eq('rut', rut)
      .maybeSingle();

    if (error || !data) {
      logger.warn('company_profiles no disponible para RUT', rut, error?.code);
      return null;
    }

    return {
      rut: data.rut,
      name: data.name,
      address: data.address,
      phone: data.phone,
      email: data.email,
      logoUrl: data.logo_url,
    };
  } catch (e) {
    logger.warn('Error obteniendo company_profile', rut, e);
    return null;
  }
};
