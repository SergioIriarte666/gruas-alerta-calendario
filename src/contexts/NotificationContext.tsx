
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNotificationsData } from '@/hooks/useNotificationsData';
import { Notification } from '@/types/notifications';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('NotificationContext');

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  unreadCount: number;
  loading: boolean;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { notifications: fetchedNotifications, loading } = useNotificationsData();

  useEffect(() => {
    if (fetchedNotifications && fetchedNotifications.length > 0) {
      try {
        const storedReadIds = JSON.parse(localStorage.getItem('read_notification_ids') || '[]');
        const readIds = new Set<string>(storedReadIds);
        // Las persistentes (dbId) traen su estado leído desde la base (read_at);
        // las derivadas en cliente lo siguen guardando en localStorage.
        const mergedNotifications = fetchedNotifications.map(n => ({
            ...n,
            read: n.dbId ? (n.read ?? false) : readIds.has(n.id)
        }));
        setNotifications(mergedNotifications);
      } catch (error) {
        logger.error('Error loading notifications:', error);
        setNotifications(fetchedNotifications.map(n => ({ ...n, read: false })));
      }
    }
  }, [fetchedNotifications]);

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
    try {
      const target = notifications.find(n => n.id === id);
      if (target?.dbId) {
        supabase
          .rpc('mark_notification_read', { p_notification_id: target.dbId })
          .then(({ error }) => {
            if (error) logger.error('Error persisting read_at:', error);
          });
      } else {
        const storedReadIds = JSON.parse(localStorage.getItem('read_notification_ids') || '[]');
        const readIds = new Set<string>(storedReadIds);
        readIds.add(id);
        localStorage.setItem('read_notification_ids', JSON.stringify(Array.from(readIds)));
      }
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = () => {
    try {
      const localIds = notifications.filter(n => !n.dbId).map(n => n.id);
      localStorage.setItem('read_notification_ids', JSON.stringify(localIds));
      if (notifications.some(n => n.dbId)) {
        supabase.rpc('mark_all_notifications_read').then(({ error }) => {
          if (error) logger.error('Error persisting read_at (all):', error);
        });
      }
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  };

  const clearAllNotifications = () => {
    try {
      setNotifications([]);
      localStorage.setItem('read_notification_ids', JSON.stringify([]));
    } catch (error) {
      logger.error('Error clearing all notifications:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    unreadCount,
    loading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
