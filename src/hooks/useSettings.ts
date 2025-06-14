
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, defaultSettings } from '@/types/settings';

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

  useEffect(() => {
    const refetch = () => {
      console.log('Received settings-updated event, refetching settings.');
      fetchSettings();
    };
    window.addEventListener('settings-updated', refetch);
    return () => {
      window.removeEventListener('settings-updated', refetch);
    };
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
    resetSettings
  };
};
