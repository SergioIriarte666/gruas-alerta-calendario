
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { CompanyData } from './types.ts';

export const fetchCompanyData = async (supabase: ReturnType<typeof createClient>): Promise<CompanyData> => {
  const { data: companyData } = await supabase
    .from('company_data')
    .select('business_name, email, phone')
    .single();

  return companyData || {};
};
