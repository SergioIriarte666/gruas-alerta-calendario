import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const UPDATE_TOAST_ID = 'sw-update-available';

const logger = createLogger("useServiceWorkerManager");
export const useServiceWorkerManager = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const watchForUpdates = useCallback((reg: ServiceWorkerRegistration) => {
    const notifyIfWaiting = () => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    };

    notifyIfWaiting();

    reg.addEventListener('updatefound', () => {
      const installingWorker = reg.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          logger.debug('[SW Manager] New version installed and waiting to activate');
          setUpdateAvailable(true);
        }
      });
    });

    const intervalId = window.setInterval(() => {
      reg.update().catch((err) => logger.warn('[SW Manager] Update check failed', err));
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const applyUpdate = useCallback(() => {
    toast.dismiss(UPDATE_TOAST_ID);

    if (!registration?.waiting) {
      window.location.reload();
      return;
    }

    const handleControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [registration]);

  useEffect(() => {
    if (!updateAvailable) return;

    toast.info('Nueva versión disponible', {
      id: UPDATE_TOAST_ID,
      description: 'Actualiza para obtener las últimas correcciones.',
      duration: Infinity,
      action: {
        label: 'Actualizar',
        onClick: applyUpdate,
      },
    });
  }, [updateAvailable, applyUpdate]);

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
        watchForUpdates(existingRegistration);
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
      watchForUpdates(newRegistration);

      return newRegistration;
    } catch (error: any) {
      const errorMsg = `Service Worker registration failed: ${error.message}`;
      logger.error('[SW Manager]', errorMsg);
      setError(errorMsg);
      setIsRegistered(false);
      setRegistration(null);
      throw new Error(errorMsg);
    }
  }, [watchForUpdates]);

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
    updateAvailable,
    applyUpdate,
    registerServiceWorker,
  };
};