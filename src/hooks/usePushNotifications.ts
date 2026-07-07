import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceWorkerManager } from './useServiceWorkerManager';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

const logger = createLogger('PushNotifications');

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
      logger.warn('[PushNotifications] Error checking support:', error);
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
      logger.warn('[PushNotifications] Error checking permission:', error);
      return 'default';
    }
  });
  const [preferences, setPreferences] = useState<PushNotificationPreferences>(defaultPreferences);

  // Check current subscription status with improved error handling
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscriptionStatus = async () => {
      try {
        logger.debug('[PushNotifications] Checking subscription status...');
        
        // First check if SW is registered
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          logger.debug('[PushNotifications] No Service Worker registered yet');
          setIsSubscribed(false);
          return;
        }

        // Check for existing subscription
        const subscription = await (registration as any).pushManager.getSubscription();
        const subscribed = !!subscription;
        logger.debug('[PushNotifications] Subscription status:', subscribed);
        setIsSubscribed(subscribed);
        
        if (subscribed) {
          setError(null); // Clear any previous errors if we have a valid subscription
        }
      } catch (error) {
        logger.error('[PushNotifications] Error checking subscription:', error);
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
        logger.debug('[PushNotifications] Preferences loaded:', parsed);
      }
    } catch (error) {
      logger.error('[PushNotifications] Error loading preferences:', error);
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
      logger.error('Error requesting permission:', error);
      setPermission('denied');
      return 'denied';
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) {
      logger.warn('[PushNotifications] Cannot subscribe - missing requirements:', { 
        user: !!user, 
        isSupported, 
        permission,
        protocol: window.location.protocol 
      });
      return false;
    }

    if (isLoading) {
      logger.debug('[PushNotifications] Already loading, skipping...');
      return false;
    }

    logger.debug('[PushNotifications] Starting subscription process...');
    setIsLoading(true);
    
    try {
      // Validate environment
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        logger.error('[PushNotifications] HTTPS required for push notifications');
        return false;
      }

      // Request permission if needed
      if (permission !== 'granted') {
        const newPermission = await Notification.requestPermission();
        setPermission(newPermission);
        if (newPermission !== 'granted') {
          logger.warn('[PushNotifications] Permission denied by user');
          return false;
        }
      }

      // Use Service Worker Manager for robust registration
      let registration: ServiceWorkerRegistration;
      
      if (isRegistered && swRegistration) {
        logger.debug('[PushNotifications] Using existing SW registration from manager');
        registration = swRegistration;
      } else {
        logger.debug('[PushNotifications] Registering SW through manager...');
        const newRegistration = await registerServiceWorker();
        if (!newRegistration) {
          throw new Error('Failed to register Service Worker');
        }
        registration = newRegistration;
      }
      logger.debug('[PushNotifications] Service Worker ready');
      
      // Check for existing subscription
      const existingSubscription = await (registration as any).pushManager.getSubscription();
      if (existingSubscription) {
        logger.debug('[PushNotifications] Already subscribed, updating status');
        setIsSubscribed(true);
        return true;
      }
      
      // Create new subscription with error handling
      const vapidPublicKey = 'BCgV2cFaHf2z1mhsxvWf7ul2lugBGh9xyrn9HT7foKzL3QFSE9bbO5sbl1zbCJ65qTZNoCuorQ8UtCHWbZ6wvNU';
      
      logger.debug('[PushNotifications] Creating subscription...');
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      logger.debug('[PushNotifications] Subscription created, saving to server...');

      // Save to server with improved error handling
      try {
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
          logger.error('[PushNotifications] Server error:', error);
          await subscription.unsubscribe().catch(e => logger.warn('Failed to cleanup subscription:', e));
          return false;
        }
      } catch (serverError) {
        logger.error('[PushNotifications] Failed to save subscription:', serverError);
        await subscription.unsubscribe().catch(e => logger.warn('Failed to cleanup subscription:', e));
        return false;
      }

      logger.debug('[PushNotifications] Subscription saved successfully');
      setIsSubscribed(true);
      setError(null);
      return true;
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      logger.error('[PushNotifications] Subscription failed:', errorMessage);
      setError(errorMessage);
      setIsSubscribed(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, permission, isLoading]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) {
      logger.error('[PushNotifications] Cannot unsubscribe - missing requirements');
      return false;
    }

    if (isLoading) {
      logger.debug('[PushNotifications] Already loading, skipping...');
      return false;
    }

    logger.debug('[PushNotifications] Starting unsubscription process...');
    setIsLoading(true);
    
    try {
      // Unsubscribe locally first
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        logger.debug('[PushNotifications] Local unsubscription successful');
      }

      // Notify server with timeout
      const removePromise = supabase.functions.invoke('remove-push-subscription', {
        body: { userId: user.id }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Server request timeout')), 5000)
      );

      try {
        await Promise.race([removePromise, timeoutPromise]);
        logger.debug('[PushNotifications] Server notification successful');
      } catch (serverError) {
        logger.warn('[PushNotifications] Server notification failed:', serverError);
        // Continue anyway, local unsubscription was successful
      }

      setIsSubscribed(false);
      setError(null);
      return true;
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      logger.error('[PushNotifications] Unsubscription failed:', errorMessage);
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
      logger.debug('[PushNotifications] Preferences updated:', updated);
    } catch (error) {
      logger.error('[PushNotifications] Error saving preferences:', error);
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
        logger.error('[PushNotifications] Error during retry check:', error);
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
