
import { supabase } from '@/integrations/supabase/client';

interface CompanyData {
  businessName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

export const fetchCompanyData = async (): Promise<CompanyData> => {
  try {
    console.log('🏢 [COMPANY] Obteniendo datos de empresa...');
    
    const { data, error } = await supabase
      .from('company_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('❌ [COMPANY] Error fetching company data:', error);
      return getDefaultCompanyData();
    }
    
    if (!data) {
      console.log('⚠️ [COMPANY] No company data found, using defaults');
      return getDefaultCompanyData();
    }
    
    console.log('✅ [COMPANY] Datos de empresa obtenidos desde BD:', {
      businessName: data.business_name,
      rut: data.rut,
      address: data.address,
      phone: data.phone,
      email: data.email,
      logoUrl: data.logo_url ? 'Logo disponible' : 'Sin logo'
    });
    
    const companyData = {
      businessName: data.business_name || 'Grúas 5 Norte',
      rut: data.rut || '76.769.841-0',
      address: data.address || 'Panamericana Norte Km. 841, Copiapó',
      phone: data.phone || '+56 9 62380627',
      email: data.email || 'asistencia@gruas5norte.cl',
      logoUrl: data.logo_url
    };

    console.log('🏢 [COMPANY] Datos finales para PDF:', companyData);
    return companyData;
  } catch (error) {
    console.error('💥 [COMPANY] Error in fetchCompanyData:', error);
    return getDefaultCompanyData();
  }
};

const getDefaultCompanyData = (): CompanyData => {
  console.log('Usando datos de empresa por defecto');
  return {
    businessName: 'Grúas 5 Norte',
    rut: '76.769.841-0',
    address: 'Panamericana Norte Km. 841, Copiapó',
    phone: '+56 9 62380627',
    email: 'asistencia@gruas5norte.cl'
  };
};
