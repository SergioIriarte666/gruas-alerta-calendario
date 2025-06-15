import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, defaultSettings } from '@/types/settings';

// 1. Define correct payload structure for company_data:
interface CompanyDataPayload {
  business_name: string;
  address: string;
  phone: string;
  email: string;
  rut: string;
  logo_url?: string | null;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
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
        };
      }

      setSettings(finalSettings);

    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Error", {
        description: "No se pudo cargar la configuración.",
      });
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const refetch = () => {
      fetchSettings();
    };
    window.addEventListener('settings-updated', refetch);
    return () => {
      window.removeEventListener('settings-updated', refetch);
    };
  }, [fetchSettings]);

  // FIX: updateSettings deep merge for nested objects
  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => {
      // Deep merge company, user, system, notifications if provided
      const merged: Settings = {
        company: updates.company
          ? { ...prev.company, ...updates.company }
          : prev.company,
        user: updates.user
          ? { ...prev.user, ...updates.user }
          : prev.user,
        system: updates.system
          ? { ...prev.system, ...updates.system }
          : prev.system,
        notifications: updates.notifications
          ? { ...prev.notifications, ...updates.notifications }
          : prev.notifications,
      };
      return merged;
    });
  };

  const saveSettings = async () => {
    if (!settings) return { success: false, error: 'Configuración no cargada.' };

    setSaving(true);
    try {
      // 2. ALWAYS assign all required fields, never let them be undefined
      const companyPayload: CompanyDataPayload = {
        business_name: settings.company.name || '',
        address: settings.company.address || '',
        phone: settings.company.phone || '',
        email: settings.company.email || '',
        rut: settings.company.taxId || '',
        logo_url:
          // logo_url is nullable but explicit; can be string or null
          typeof settings.company.logo === 'string'
            ? settings.company.logo
            : null,
      };

      // 3. VALIDATE required fields before sending (optional, but good dev check):
      if (
        !companyPayload.business_name ||
        !companyPayload.address ||
        !companyPayload.phone ||
        !companyPayload.email ||
        !companyPayload.rut
      ) {
        console.warn(
          '[useSettings] Al menos un campo obligatorio de empresa está vacío.',
          companyPayload
        );
        // podrías retornar error si así lo deseas:
        // return { success: false, error: 'Faltan campos obligatorios de empresa.' };
      }

      console.log('Intentando guardar datos de empresa (payload enviado):', companyPayload);

      // Buscar empresa, si no existe: insertar, si existe: actualizar
      const { data: existingCompany, error: selectError } = await supabase
        .from('company_data')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error('Error al consultar company_data:', selectError);
        throw selectError;
      }

      if (existingCompany && existingCompany.id) {
        // UPDATE: Pass a single object (not array) for update
        const { error: updateError } = await supabase
          .from('company_data')
          .update(companyPayload)
          .eq('id', existingCompany.id);

        if (updateError) {
          console.error('Error al actualizar la empresa:', updateError);
          throw updateError;
        }
        console.log('Empresa actualizada correctamente');

      } else {
        // INSERT: Pass an array of exactly-typed objects
        const { data: newCompany, error: insertError } = await supabase
          .from('company_data')
          .insert([companyPayload] as CompanyDataPayload[])
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error al insertar empresa:', insertError);
          throw insertError;
        }
        if (!newCompany || !newCompany.id) {
          throw new Error('No se pudo crear el registro de empresa');
        }
        console.log('Empresa creada correctamente:', newCompany.id);
      }

      // Otros settings a local storage (user, system, notifications)
      const { company, ...otherSettings } = settings;
      localStorage.setItem('tms-settings-others', JSON.stringify(otherSettings));
      localStorage.removeItem('tms-settings');

      // **FORZAR ACTUALIZACIÓN** tras guardar para tener datos frescos
      setTimeout(() => {
        window.dispatchEvent(new Event('settings-updated'));
      }, 350);

      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: 'Error al guardar la configuración: ' + (error?.message || 'Desconocido') };
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('tms-settings');
    localStorage.removeItem('tms-settings-others');
    // En desarrollo: aquí podríamos limpiar company_data en Supabase si fuera necesario.
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
