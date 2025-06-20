
export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logo?: string;
  folioFormat: string;
}

export interface UserSettings {
  language: 'es' | 'en';
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  notifications: boolean;
}

export interface SystemSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetention: number;
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
    name: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    folioFormat: 'SRV-{number}',
  },
  user: {
    language: 'es',
    theme: 'system',
    timezone: 'America/Santiago',
    notifications: true,
  },
  system: {
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: 12,
    maintenanceMode: false,
  },
  notifications: {
    emailNotifications: true,
    serviceReminders: true,
    invoiceAlerts: true,
    overdueNotifications: true,
    systemUpdates: false,
  },
};
