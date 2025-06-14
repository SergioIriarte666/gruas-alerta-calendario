import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logo?: string;
}

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  currency: 'CLP' | 'USD' | 'EUR';
}

interface SystemSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetention: number; // months
  maintenanceMode: boolean;
}

interface NotificationSettings {
  emailNotifications: boolean;
  serviceReminders: boolean;
  invoiceAlerts: boolean;
  overdueNotifications: boolean;
  systemUpdates: boolean;
}

interface Settings {
  company: CompanySettings;
  user: UserSettings;
  system: SystemSettings;
  notifications: NotificationSettings;
}

const defaultSettings: Settings = {
  company: {
    name: 'TMS Grúas Ltda.',
    address: 'Av. Principal 1234, Santiago, Chile',
    phone: '+56 2 2345 6789',
    email: 'contacto@tmsgruas.cl',
    taxId: '12.345.678-9',
    logo: undefined
  },
  user: {
    theme: 'dark',
    language: 'es',
    timezone: 'America/Santiago',
    dateFormat: 'DD/MM/YYYY',
    currency: 'CLP'
  },
  system: {
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: 12,
    maintenanceMode: false
  },
  notifications: {
    emailNotifications: true,
    serviceReminders: true,
    invoiceAlerts: true,
    overdueNotifications: true,
    systemUpdates: false
  }
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: companyData, error: companyError } = await supabase
        .from('company_data')
        .select('*')
        .limit(1)
        .single();
      
      if (companyError && companyError.code !== 'PGRST116') { // Ignore no rows found error
        throw companyError;
      }

      const savedOtherSettings = localStorage.getItem('tms-settings-others');
      const otherSettings = savedOtherSettings ? JSON.parse(savedOtherSettings) : {
        user: defaultSettings.user,
        system: defaultSettings.system,
        notifications: defaultSettings.notifications,
      };

      if (companyData) {
        setSettings({
          company: {
            name: companyData.business_name,
            address: companyData.address,
            phone: companyData.phone,
            email: companyData.email,
            taxId: companyData.rut,
            logo: companyData.logo_url || undefined,
          },
          ...otherSettings,
        });
      } else {
        const savedSettings = localStorage.getItem('tms-settings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        } else {
          setSettings(defaultSettings);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración.",
        variant: "destructive",
      });
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const saveSettings = async () => {
    if (!settings) return { success: false, error: 'Configuración no cargada.' };

    setSaving(true);
    try {
      if (settings.company) {
        const { data: existingCompany } = await supabase.from('company_data').select('id').limit(1).single();
        
        const companyPayload = {
          business_name: settings.company.name,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
          rut: settings.company.taxId,
        };

        if (existingCompany) {
          const { error } = await supabase.from('company_data').update(companyPayload).eq('id', existingCompany.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('company_data').insert(companyPayload).select().single();
          if (error) throw error;
        }
      }
      
      const { company, ...otherSettings } = settings;
      localStorage.setItem('tms-settings-others', JSON.stringify(otherSettings));
      
      localStorage.setItem('tms-settings', JSON.stringify(settings));
      
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: 'Error al guardar la configuración' };
    } finally {
      setSaving(false);
    }
  };

  const updateLogo = async (logoFile: File | null) => {
    if (!settings) return { success: false, error: 'Configuración no cargada.' };
    setSaving(true);
    try {
      let { data: companyData } = await supabase.from('company_data').select('id, logo_url').limit(1).single();

      if (!companyData) {
        const { data: newCompanyData, error } = await supabase.from('company_data').insert({
          business_name: settings.company.name,
          rut: settings.company.taxId,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
        }).select('id, logo_url').single();

        if (error) throw error;
        companyData = newCompanyData;
      }

      if (companyData.logo_url) {
        const oldLogoPath = companyData.logo_url.split('/company-assets/')[1];
        if (oldLogoPath) {
          await supabase.storage.from('company-assets').remove([oldLogoPath]);
        }
      }

      let newLogoUrl: string | undefined = undefined;

      if (logoFile) {
        const filePath = `public/logo-${Date.now()}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(uploadData.path);
        
        newLogoUrl = urlData.publicUrl;
      }
      
      const { error: dbError } = await supabase
        .from('company_data')
        .update({ logo_url: newLogoUrl })
        .eq('id', companyData.id);

      if (dbError) throw dbError;

      await fetchSettings();
      return { success: true };
    } catch (error) {
      console.error('Error updating logo:', error);
      return { success: false, error: 'Error al guardar el logotipo' };
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('tms-settings');
    localStorage.removeItem('tms-settings-others');
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    saveSettings,
    updateLogo,
    resetSettings
  };
};
