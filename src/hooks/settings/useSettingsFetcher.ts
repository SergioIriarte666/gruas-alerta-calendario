
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, defaultSettings } from '@/types/settings';

export const useSettingsFetcher = () => {
  const fetchSettings = useCallback(async (): Promise<Settings> => {
    console.log('Fetching settings...');
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('company_data')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }
      console.log('Fetched company data from Supabase:', companyData);

      // Otros settings desde local storage
      const savedOtherSettings = localStorage.getItem('tms-settings-others');
      const otherSettings = savedOtherSettings ? JSON.parse(savedOtherSettings) : {
        user: defaultSettings.user,
        system: defaultSettings.system,
        notifications: defaultSettings.notifications,
      };

      const finalSettings: Settings = {
        company: defaultSettings.company,
        ...otherSettings
      };

      if (companyData) {
        finalSettings.company = {
          name: companyData.business_name || defaultSettings.company.name,
          address: companyData.address || defaultSettings.company.address,
          phone: companyData.phone || defaultSettings.company.phone,
          email: companyData.email || defaultSettings.company.email,
          taxId: companyData.rut || defaultSettings.company.taxId,
          logo: companyData.logo_url ? `${companyData.logo_url}?t=${new Date().getTime()}` : undefined,
          folioFormat: companyData.folio_format || defaultSettings.company.folioFormat,
          nextServiceFolioNumber: companyData.next_service_folio_number || 1000,
        };
      }

      return finalSettings;

    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Error", {
        description: "No se pudo cargar la configuración.",
      });
      return defaultSettings;
    }
  }, []);

  return { fetchSettings };
};
