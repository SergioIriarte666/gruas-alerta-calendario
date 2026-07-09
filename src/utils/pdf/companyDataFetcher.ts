import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { type CompanySettings } from '@/types/settings';

const logger = createLogger('CompanyDataFetcher');

export interface CompanyData {
  businessName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  legalTexts?: string;
  website?: string;
}

const buildFallbackCompany = (fallback?: Partial<CompanySettings>): CompanyData => ({
  businessName: fallback?.name || '',
  rut: fallback?.taxId || '',
  address: fallback?.address || '',
  phone: fallback?.phone || '',
  email: fallback?.email || '',
  logoUrl: fallback?.logo || undefined,
});

export const fetchCompanyData = async (fallback?: Partial<CompanySettings>): Promise<CompanyData> => {
  const fallbackCompany = buildFallbackCompany(fallback);

  try {
    // maybeSingle() no lanza error si no hay filas o si RLS bloquea (406)
    const { data, error } = await supabase
      .from('company_data')
      .select('business_name, rut, address, phone, email, logo_url, legal_texts, website')
      .maybeSingle();

    if (error || !data) {
      logger.warn('company_data no disponible, usando defaults:', error?.code);
      return fallbackCompany;
    }

    return {
      businessName: data.business_name || fallbackCompany.businessName,
      rut: data.rut || fallbackCompany.rut,
      address: data.address || fallbackCompany.address,
      phone: data.phone || fallbackCompany.phone,
      email: data.email || fallbackCompany.email,
      logoUrl: data.logo_url || fallbackCompany.logoUrl,
      legalTexts: data.legal_texts || undefined,
      website: data.website || undefined,
    };
  } catch {
    return fallbackCompany;
  }
};
