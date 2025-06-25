
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
    console.log('=== OBTENIENDO DATOS DE EMPRESA ===');
    
    const { data, error } = await supabase
      .from('company_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching company data:', error);
      return getDefaultCompanyData();
    }
    
    if (!data) {
      console.log('No company data found, using defaults');
      return getDefaultCompanyData();
    }
    
    console.log('Datos de empresa obtenidos:', {
      businessName: data.business_name,
      rut: data.rut,
      address: data.address,
      phone: data.phone,
      email: data.email
    });
    
    return {
      businessName: data.business_name || 'TMS - Transport Management System',
      rut: data.rut || '12.345.678-9',
      address: data.address || 'Av. Principal 123, Santiago',
      phone: data.phone || '+56 9 1234 5678',
      email: data.email || 'contacto@tms.cl',
      logoUrl: data.logo_url
    };
  } catch (error) {
    console.error('Error in fetchCompanyData:', error);
    return getDefaultCompanyData();
  }
};

const getDefaultCompanyData = (): CompanyData => {
  console.log('Usando datos de empresa por defecto');
  return {
    businessName: 'TMS - Transport Management System',
    rut: '12.345.678-9',
    address: 'Av. Principal 123, Santiago',
    phone: '+56 9 1234 5678',
    email: 'contacto@tms.cl'
  };
};
