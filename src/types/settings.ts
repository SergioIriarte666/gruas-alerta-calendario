import { ReportColumnsConfig } from './reportColumnConfig';

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logo?: string;
  folioFormat: string;
  nextServiceFolioNumber?: number; // Nuevo campo para controlar numeración
  /** Telefono de contacto operativo (independiente de `phone`), usado en el
   * boton de llamada de la pagina publica de seguimiento (/track/:token). */
  operationalContactPhone: string;
}

export type { ReportColumnsConfig } from './reportColumnConfig';

export interface UserSettings {
  language: 'es' | 'en';
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  useSystemTimezone: boolean;
  notifications: boolean;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  currency: 'CLP' | 'USD' | 'EUR';
}

export interface UserDatabaseSettings {
  timezone: string;
  use_system_timezone: boolean;
  date_format: string;
  language: string;
  currency: string;
}

export interface SystemSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetention: number;
  maintenanceMode: boolean;
  reportColumnConfig?: ReportColumnsConfig;
  /** Margen de venta por defecto (%) para productos de inventario sin configuración propia. */
  defaultSaleMarkupPercent: number;
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
    operationalContactPhone: '',
  },
  user: {
    language: 'es',
    theme: 'system',
    timezone: 'America/Santiago',
    useSystemTimezone: true,
    notifications: true,
    dateFormat: 'DD/MM/YYYY',
    currency: 'CLP',
  },
  system: {
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: 12,
    maintenanceMode: false,
    defaultSaleMarkupPercent: 30,
  },
  notifications: {
    emailNotifications: true,
    serviceReminders: true,
    invoiceAlerts: true,
    overdueNotifications: true,
    systemUpdates: false,
  },
};
