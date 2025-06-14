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
    if (!settings) {
      console.error("updateLogo: Settings not loaded.");
      return { success: false, error: 'Configuración no cargada.' };
    }
    setSaving(true);
    console.log("updateLogo: Starting logo update process.");

    let oldLogoUrlToDelete: string | null = null;
    let newLogoUrl: string | undefined = undefined;

    try {
      // Step 1: Get or create company data entry
      let { data: companyData, error: companySelectError } = await supabase.from('company_data').select('id, logo_url').limit(1).maybeSingle();
      if (companySelectError) {
        console.error("updateLogo: Error fetching company data.", companySelectError);
        throw new Error('Error al consultar datos de la empresa.');
      }
      
      console.log("updateLogo: Fetched company data:", companyData);

      if (!companyData) {
        console.log("updateLogo: No company data found, creating new entry.");
        const { data: newCompanyData, error: companyInsertError } = await supabase.from('company_data').insert({
          business_name: settings.company.name,
          rut: settings.company.taxId,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
        }).select('id, logo_url').single();

        if (companyInsertError) {
          console.error("updateLogo: Error inserting new company data.", companyInsertError);
          throw new Error('Error al crear registro para la empresa.');
        }
        companyData = newCompanyData;
        console.log("updateLogo: New company data created:", companyData);
      }
      
      oldLogoUrlToDelete = companyData.logo_url;
      console.log("updateLogo: Old logo URL to delete (if any):", oldLogoUrlToDelete);


      // Step 2: Handle logo file upload/removal
      if (logoFile) {
        console.log("updateLogo: New logo file provided. Uploading...");
        const filePath = `public/logo-${Date.now()}-${logoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(filePath, logoFile);

        if (uploadError) {
          console.error('updateLogo: Storage upload error:', uploadError);
          throw new Error('Error al subir el nuevo logotipo.');
        }
        
        console.log("updateLogo: Upload successful. Data:", uploadData);

        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(uploadData.path);
        
        newLogoUrl = urlData.publicUrl;
        console.log("updateLogo: New public URL:", newLogoUrl);
      } else {
        console.log("updateLogo: No logo file provided, logo will be removed.");
        newLogoUrl = undefined;
      }
      
      // Step 3: Update database with new logo URL
      console.log("updateLogo: Updating database with new logo URL.");
      const { error: dbError } = await supabase
        .from('company_data')
        .update({ logo_url: newLogoUrl })
        .eq('id', companyData.id);

      if (dbError) {
        console.error('updateLogo: Database update error:', dbError);
        // If DB update fails, try to remove the newly uploaded file to avoid orphaned files
        if (newLogoUrl) {
            const newPath = newLogoUrl.split('/company-assets/')[1];
            if (newPath) {
                console.log("updateLogo: Rolling back upload. Removing:", newPath);
                await supabase.storage.from('company-assets').remove([newPath]);
            }
        }
        throw new Error('Error al guardar la URL del logotipo en la base de datos.');
      }
      console.log("updateLogo: Database updated successfully.");

      // Step 4: Remove old logo from storage if new one was saved
      if (oldLogoUrlToDelete) {
        const oldLogoPath = oldLogoUrlToDelete.split('/company-assets/')[1];
        if (oldLogoPath && oldLogoPath !== newLogoUrl?.split('/company-assets/')[1]) {
          console.log("updateLogo: Removing old logo from storage:", oldLogoPath);
          const { error: removeError } = await supabase.storage.from('company-assets').remove([oldLogoPath]);
          if(removeError) {
             console.error("updateLogo: Failed to remove old logo, but continuing as new logo is set.", removeError);
          }
        }
      }

      // Step 5: Update local state
      console.log("updateLogo: Updating local settings state.");
      setSettings(prev => {
        if (!prev) return defaultSettings;
        const newSettings = {
          ...prev,
          company: {
            ...prev.company,
            logo: newLogoUrl,
          },
        };
        console.log("updateLogo: New local state:", newSettings);
        return newSettings;
      });

      console.log("updateLogo: Process completed successfully.");
      return { success: true };

    } catch (error) {
      console.error('updateLogo: An error occurred in the process.', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar el logotipo';
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
      console.log("updateLogo: Finished. Saving state is false.");
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
