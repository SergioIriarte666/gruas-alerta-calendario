
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNotificationsData } from '@/hooks/useNotificationsData';
import { Notification } from '@/types/notifications';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
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
        
        const mergedNotifications = fetchedNotifications.map(n => ({
            ...n,
            read: readIds.has(n.id)
        }));
          
        setNotifications(mergedNotifications);
      } catch (error) {
        console.error('Error loading notifications:', error);
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
      const storedReadIds = JSON.parse(localStorage.getItem('read_notification_ids') || '[]');
      const readIds = new Set<string>(storedReadIds);
      readIds.add(id);
      localStorage.setItem('read_notification_ids', JSON.stringify(Array.from(readIds)));

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = () => {
    try {
      const allIds = notifications.map(n => n.id);
      localStorage.setItem('read_notification_ids', JSON.stringify(allIds));
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    unreadCount,
    loading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
