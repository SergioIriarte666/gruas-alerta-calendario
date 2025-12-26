
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'services' | 'invoices' | 'documents' | 'closures' | 'system';
export type NotificationPriority = 1 | 2 | 3 | 4 | 5;

export interface Notification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  timestamp: Date;
  read: boolean;
  read_at?: string | null;
  dismissed_at?: string | null;
  snoozed_until?: string | null;
  expires_at?: string | null;
  group_key?: string | null;
  group_count?: number;
  actionType?: 'navigate' | 'filter' | 'highlight';
  actionUrl?: string;
  actionData?: {
    entityId?: string;
    filter?: string;
    highlight?: string;
  };
  entity_type?: string;
  entity_id?: string;
  created_at?: string;
}

export interface NotificationGroup {
  key: string;
  title: string;
  count: number;
  notifications: Notification[];
  priority: NotificationPriority;
  category: NotificationCategory;
}

export interface NotificationFilters {
  category?: NotificationCategory | 'all';
  status?: 'unread' | 'read' | 'all';
  priority?: NotificationPriority | 'all';
  search?: string;
}

export interface NotificationSummary {
  total_count: number;
  unread_count: number;
  critical_count: number;
  categories: Record<string, number>;
}

export interface InvoiceAlertSettings {
  id?: string;
  user_id?: string;
  overdue_alerts_enabled: boolean;
  due_soon_alerts_enabled: boolean;
  due_soon_days: number;
  email_notifications: boolean;
  push_notifications: boolean;
}

export interface OverdueInvoice {
  id: string;
  folio: string;
  client_name: string;
  due_date: string;
  total: number;
  days_overdue: number;
  status: string;
}

export interface InvoiceDueSoon {
  id: string;
  folio: string;
  client_name: string;
  due_date: string;
  total: number;
  days_until_due: number;
  status: string;
}

// Priority labels and colors
export const PRIORITY_CONFIG: Record<NotificationPriority, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Crítico', color: 'text-white', bgColor: 'bg-red-500' },
  2: { label: 'Urgente', color: 'text-black', bgColor: 'bg-amber-500' },
  3: { label: 'Importante', color: 'text-white', bgColor: 'bg-blue-500' },
  4: { label: 'Normal', color: 'text-white', bgColor: 'bg-gray-500' },
  5: { label: 'Bajo', color: 'text-gray-700', bgColor: 'bg-gray-200' },
};

export const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: string }> = {
  services: { label: 'Servicios', icon: 'Truck' },
  invoices: { label: 'Facturas', icon: 'FileText' },
  documents: { label: 'Documentos', icon: 'FileWarning' },
  closures: { label: 'Cierres', icon: 'CheckCircle' },
  system: { label: 'Sistema', icon: 'Settings' },
};
