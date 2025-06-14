
export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logo?: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  currency: 'CLP' | 'USD' | 'EUR';
}

export interface SystemSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetention: number; // months
  maintenanceMode: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  serviceReminders: boolean;
  invoiceAlerts: boolean;
  overdueNotifications: boolean;
  systemUpdates: boolean;
}

export interface Settings {
  company: CompanySettings;
  user: UserSettings;
  system: SystemSettings;
  notifications: NotificationSettings;
}

export const defaultSettings: Settings = {
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
