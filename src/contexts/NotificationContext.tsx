
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Notification {
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

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Nuevo servicio programado',
      message: 'Servicio de grúa para Cliente ABC - Mañana 08:00',
      type: 'info',
      timestamp: new Date(),
      read: false,
      actionType: 'navigate',
      actionUrl: '/services',
      actionData: {
        filter: 'programado'
      }
    },
    {
      id: '2', 
      title: 'Pago recibido',
      message: 'Factura #1234 - $450.000 CLP pagada por Cliente XYZ',
      type: 'success',
      timestamp: new Date(Date.now() - 3600000),
      read: false,
      actionType: 'navigate',
      actionUrl: '/invoices',
      actionData: {
        entityId: '1234',
        highlight: 'invoice-1234'
      }
    },
    {
      id: '3',
      title: 'Mantenimiento pendiente',
      message: 'Grúa GR-001 requiere mantenimiento programado',
      type: 'warning',
      timestamp: new Date(Date.now() - 7200000),
      read: false,
      actionType: 'navigate',
      actionUrl: '/cranes',
      actionData: {
        entityId: 'GR-001',
        filter: 'mantenimiento'
      }
    },
    {
      id: '4',
      title: 'Servicio completado',
      message: 'Servicio #789 finalizado correctamente - Cliente DEF',
      type: 'success',
      timestamp: new Date(Date.now() - 14400000),
      read: true,
      actionType: 'navigate',
      actionUrl: '/services',
      actionData: {
        entityId: '789'
      }
    },
    {
      id: '5',
      title: 'Cierre pendiente',
      message: 'Período semanal listo para cierre - 15 servicios',
      type: 'info',
      timestamp: new Date(Date.now() - 21600000),
      read: false,
      actionType: 'navigate',
      actionUrl: '/closures'
    }
  ]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      markAsRead,
      markAllAsRead,
      unreadCount
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
