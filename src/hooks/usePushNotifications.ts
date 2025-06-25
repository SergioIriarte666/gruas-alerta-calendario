
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface PushNotificationPreferences {
  newServices: boolean;
  serviceUpdates: boolean;
  inspectionCompleted: boolean;
  invoiceGenerated: boolean;
  systemAlerts: boolean;
}

export interface PushNotificationHook {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  preferences: PushNotificationPreferences;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  updatePreferences: (preferences: Partial<PushNotificationPreferences>) => void;
}

const defaultPreferences: PushNotificationPreferences = {
  newServices: true,
  serviceUpdates: true,
  inspectionCompleted: true,
  invoiceGenerated: false,
  systemAlerts: true,
};

export const usePushNotifications = (): PushNotificationHook => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<PushNotificationPreferences>(defaultPreferences);

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    }
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    if (user) {
      try {
        const stored = localStorage.getItem(`push-preferences-${user.id}`);
        if (stored) {
          setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
        }
      } catch (error) {
        console.error('Error loading push preferences:', error);
      }
    }
  }, [user]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return 'denied';
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported || permission !== 'granted') {
      return false;
    }

    try {
      setIsLoading(true);
      // Simplified subscription logic
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, permission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) {
      return false;
    }

    try {
      setIsLoading(true);
      // Simplified unsubscription logic
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const updatePreferences = useCallback((newPreferences: Partial<PushNotificationPreferences>) => {
    if (!user) return;

    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    
    try {
      localStorage.setItem(`push-preferences-${user.id}`, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }, [user, preferences]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    subscribe,
    unsubscribe,
    requestPermission,
    updatePreferences,
  };
};
