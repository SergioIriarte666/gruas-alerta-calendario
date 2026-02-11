import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceWorkerManager } from './useServiceWorkerManager';

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
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  updatePreferences: (preferences: Partial<PushNotificationPreferences>) => void;
  retry: () => Promise<void>;
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
  const { isRegistered, registration: swRegistration, registerServiceWorker } = useServiceWorkerManager();
  const [isSupported] = useState(() => {
    try {
      return typeof window !== 'undefined' && 
             window.location.protocol === 'https:' &&
             'serviceWorker' in navigator && 
             'PushManager' in window && 
             'Notification' in window &&
             !window.navigator.userAgent.includes('jsdom'); // Exclude test environments
    } catch (error) {
      console.warn('[PushNotifications] Error checking support:', error);
      return false;
    }
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    try {
      return typeof window !== 'undefined' ? Notification.permission : 'default';
    } catch (error) {
      console.warn('[PushNotifications] Error checking permission:', error);
      return 'default';
    }
  });
  const [preferences, setPreferences] = useState<PushNotificationPreferences>(defaultPreferences);

  // Check current subscription status with improved error handling
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscriptionStatus = async () => {
      try {
        console.log('[PushNotifications] Checking subscription status...');
        
        // First check if SW is registered
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.log('[PushNotifications] No Service Worker registered yet');
          setIsSubscribed(false);
          return;
        }

        // Check for existing subscription
        const subscription = await (registration as any).pushManager.getSubscription();
        const subscribed = !!subscription;
        console.log('[PushNotifications] Subscription status:', subscribed);
        setIsSubscribed(subscribed);
        
        if (subscribed) {
          setError(null); // Clear any previous errors if we have a valid subscription
        }
      } catch (error) {
        console.error('[PushNotifications] Error checking subscription:', error);
        setIsSubscribed(false);
        setError(`Error checking subscription: ${error}`);
      }
    };

    checkSubscriptionStatus();
  }, [isSupported, user]);

  // Load preferences from localStorage - only once when user changes
  useEffect(() => {
    if (!user) return;
    
    try {
      const stored = localStorage.getItem(`push-preferences-${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
        console.log('[PushNotifications] Preferences loaded:', parsed);
      }
    } catch (error) {
      console.error('[PushNotifications] Error loading preferences:', error);
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
      setPermission('denied');
      return 'denied';
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) {
      console.warn('[PushNotifications] Cannot subscribe - missing requirements:', { 
        user: !!user, 
        isSupported, 
        permission,
        protocol: window.location.protocol 
      });
      return false;
    }

    if (isLoading) {
      console.log('[PushNotifications] Already loading, skipping...');
      return false;
    }

    console.log('[PushNotifications] Starting subscription process...');
    setIsLoading(true);
    
    try {
      // Validate environment
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.error('[PushNotifications] HTTPS required for push notifications');
        return false;
      }

      // Request permission if needed
      if (permission !== 'granted') {
        const newPermission = await Notification.requestPermission();
        setPermission(newPermission);
        if (newPermission !== 'granted') {
          console.warn('[PushNotifications] Permission denied by user');
          return false;
        }
      }

      // Use Service Worker Manager for robust registration
      let registration: ServiceWorkerRegistration;
      
      if (isRegistered && swRegistration) {
        console.log('[PushNotifications] Using existing SW registration from manager');
        registration = swRegistration;
      } else {
        console.log('[PushNotifications] Registering SW through manager...');
        const newRegistration = await registerServiceWorker();
        if (!newRegistration) {
          throw new Error('Failed to register Service Worker');
        }
        registration = newRegistration;
      }
      console.log('[PushNotifications] Service Worker ready');
      
      // Check for existing subscription
      const existingSubscription = await (registration as any).pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[PushNotifications] Already subscribed, updating status');
        setIsSubscribed(true);
        return true;
      }
      
      // Create new subscription with error handling
      const vapidPublicKey = 'BCgV2cFaHf2z1mhsxvWf7ul2lugBGh9xyrn9HT7foKzL3QFSE9bbO5sbl1zbCJ65qTZNoCuorQ8UtCHWbZ6wvNU';
      
      console.log('[PushNotifications] Creating subscription...');
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      console.log('[PushNotifications] Subscription created, saving to server...');

      // Save to server with improved error handling
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const savePromise = supabase.functions.invoke('save-push-subscription', {
          body: {
            userId: user.id,
            subscription: subscription.toJSON(),
            userAgent: navigator.userAgent
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Server request timeout')), 8000)
        );

        const { error } = await Promise.race([savePromise, timeoutPromise]) as any;

        if (error) {
          console.error('[PushNotifications] Server error:', error);
          await subscription.unsubscribe().catch(e => console.warn('Failed to cleanup subscription:', e));
          return false;
        }
      } catch (serverError) {
        console.error('[PushNotifications] Failed to save subscription:', serverError);
        await subscription.unsubscribe().catch(e => console.warn('Failed to cleanup subscription:', e));
        return false;
      }

      console.log('[PushNotifications] Subscription saved successfully');
      setIsSubscribed(true);
      setError(null);
      return true;
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      console.error('[PushNotifications] Subscription failed:', errorMessage);
      setError(errorMessage);
      setIsSubscribed(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, permission, isLoading]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) {
      console.error('[PushNotifications] Cannot unsubscribe - missing requirements');
      return false;
    }

    if (isLoading) {
      console.log('[PushNotifications] Already loading, skipping...');
      return false;
    }

    console.log('[PushNotifications] Starting unsubscription process...');
    setIsLoading(true);
    
    try {
      // Unsubscribe locally first
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log('[PushNotifications] Local unsubscription successful');
      }

      // Notify server with timeout
      const { supabase } = await import('@/integrations/supabase/client');
      
      const removePromise = supabase.functions.invoke('remove-push-subscription', {
        body: { userId: user.id }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Server request timeout')), 5000)
      );

      try {
        await Promise.race([removePromise, timeoutPromise]);
        console.log('[PushNotifications] Server notification successful');
      } catch (serverError) {
        console.warn('[PushNotifications] Server notification failed:', serverError);
        // Continue anyway, local unsubscription was successful
      }

      setIsSubscribed(false);
      setError(null);
      return true;
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      console.error('[PushNotifications] Unsubscription failed:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, isLoading]);

  const updatePreferences = useCallback((newPreferences: Partial<PushNotificationPreferences>) => {
    if (!user) return;

    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    
    try {
      localStorage.setItem(`push-preferences-${user.id}`, JSON.stringify(updated));
      console.log('[PushNotifications] Preferences updated:', updated);
    } catch (error) {
      console.error('[PushNotifications] Error saving preferences:', error);
    }
  }, [user, preferences]);

  const retry = useCallback(async (): Promise<void> => {
    setError(null);
    setIsLoading(false);
    
    // Re-check subscription status
    if (isSupported && user) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('[PushNotifications] Error during retry check:', error);
      }
    }
  }, [isSupported, user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
    updatePreferences,
    retry,
  };
};