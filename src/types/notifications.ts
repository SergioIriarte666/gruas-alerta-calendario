
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  /** UUID en public.notifications cuando la alerta es persistente (generada en
   * servidor). Su estado leído vive en la base (read_at), no en localStorage. */
  dbId?: string;
  actionType?: 'navigate' | 'filter' | 'highlight';
  actionUrl?: string;
  actionData?: {
    entityId?: string;
    filter?: string;
    highlight?: string;
  };
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
