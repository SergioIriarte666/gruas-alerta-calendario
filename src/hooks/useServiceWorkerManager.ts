import { useState, useEffect, useCallback } from 'react';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceWorkerManager");
export const useServiceWorkerManager = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
      const errorMsg = 'Service Workers not supported';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      logger.debug('[SW Manager] Registering Service Worker...');
      
      // Check if already registered
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      if (existingRegistration) {
        logger.debug('[SW Manager] Using existing registration');
        setRegistration(existingRegistration);
        setIsRegistered(true);
        setError(null);
        return existingRegistration;
      }

      // Register new service worker
      const newRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      logger.debug('[SW Manager] Service Worker registered successfully');
      
      // Wait for it to be ready
      await navigator.serviceWorker.ready;
      
      setRegistration(newRegistration);
      setIsRegistered(true);
      setError(null);
      
      return newRegistration;
    } catch (error: any) {
      const errorMsg = `Service Worker registration failed: ${error.message}`;
      logger.error('[SW Manager]', errorMsg);
      setError(errorMsg);
      setIsRegistered(false);
      setRegistration(null);
      throw new Error(errorMsg);
    }
  }, []);

  // Auto-register on mount if supported
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      registerServiceWorker().catch(err => logger.error('[SW Manager]', err));
    }
  }, [registerServiceWorker]);

  return {
    isRegistered,
    registration,
    error,
    registerServiceWorker,
  };
};