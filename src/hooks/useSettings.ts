import { useState, useEffect } from 'react';

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

// Mock data inicial
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

  useEffect(() => {
    // Simular carga de configuración
    setTimeout(() => {
      const savedSettings = localStorage.getItem('tms-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      setLoading(false);
    }, 500);
  }, []);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    setSaving(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      localStorage.setItem('tms-settings', JSON.stringify(updatedSettings));
      
      // Simular guardado en servidor
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: 'Error al guardar la configuración' };
    } finally {
      setSaving(false);
    }
  };

  const updateLogo = async (logoData: string | null) => {
    setSaving(true);
    try {
      const updatedCompanySettings = {
        ...settings.company,
        logo: logoData || undefined
      };
      
      const updatedSettings = {
        ...settings,
        company: updatedCompanySettings
      };
      
      setSettings(updatedSettings);
      localStorage.setItem('tms-settings', JSON.stringify(updatedSettings));
      
      // Simular guardado en servidor
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true };
    } catch (error) {
      console.error('Error saving logo:', error);
      return { success: false, error: 'Error al guardar el logotipo' };
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('tms-settings');
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    updateLogo,
    resetSettings
  };
};
