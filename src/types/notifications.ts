
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionType?: 'navigate' | 'filter' | 'highlight';
  actionUrl?: string;
  actionData?: {
    entityId?: string;
    filter?: string;
    highlight?: string;
  };
}
