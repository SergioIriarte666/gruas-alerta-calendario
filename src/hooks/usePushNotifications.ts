
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [isLoading, setIsLoading] = useState(true);
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
    setIsLoading(false);
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

  // Check if user is already subscribed
  useEffect(() => {
    if (user && isSupported && permission === 'granted') {
      checkSubscription();
    }
  }, [user, isSupported, permission]);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    }
  }, []);

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
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BMxXWf8fU5lE8K9aMOHh7ROGHgXWCGUVLJNVf2fR7lQ8rJkYT8Pm8Wf8wFgxJ2sL4zQ3DxK7vL5pM8wB6rF3nY4'
        });
      }

      // Save subscription to database
      const { error } = await supabase.functions.invoke('save-push-subscription', {
        body: {
          userId: user.id,
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent
        }
      });

      if (error) {
        console.error('Error saving subscription:', error);
        return false;
      }

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
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove subscription from database
      const { error } = await supabase.functions.invoke('remove-push-subscription', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Error removing subscription:', error);
      }

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
