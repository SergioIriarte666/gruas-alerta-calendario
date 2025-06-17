
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';

interface InstallPrompt {
  canInstall: boolean;
  install: () => Promise<void>;
  isInstalled: boolean;
}

interface NotificationStatus {
  permission: NotificationPermission;
  request: () => Promise<NotificationPermission>;
  isSupported: boolean;
}

interface SyncStatus {
  isOnline: boolean;
  pendingActions: number;
  lastSync: Date | null;
}

interface OfflineCapabilities {
  canWorkOffline: boolean;
  hasOfflineData: boolean;
  syncInProgress: boolean;
}

interface PWACapabilities {
  canWork: boolean;
  canInstall: boolean;
  hasNotifications: boolean;
  syncStatus: SyncStatus;
  offlineActions: number;
  installApp: () => Promise<void>;
  enableNotifications: () => Promise<NotificationPermission>;
  clearOfflineData: () => Promise<void>;
}

export const usePWACapabilities = (): PWACapabilities => {
  const { user } = useUser();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [pendingActions, setPendingActions] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Detectar estado online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger background sync cuando vuelve la conexión
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
          registration.sync.register('offline-action');
        });
      }
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Detectar install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar si ya está instalado
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Monitorear permission de notificaciones
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Monitorear acciones pendientes offline
  useEffect(() => {
    const checkPendingActions = async () => {
      if ('indexedDB' in window) {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('TMSOfflineDB', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          const stores = ['pendingServiceUpdates', 'pendingInspections', 'offlineActions'];
          let totalPending = 0;

          for (const storeName of stores) {
            if (db.objectStoreNames.contains(storeName)) {
              const transaction = db.transaction([storeName], 'readonly');
              const store = transaction.objectStore(storeName);
              const count = await new Promise<number>((resolve) => {
                const countRequest = store.count();
                countRequest.onsuccess = () => resolve(countRequest.result);
                countRequest.onerror = () => resolve(0);
              });
              totalPending += count;
            }
          }

          setPendingActions(totalPending);
          db.close();
        } catch (error) {
          console.error('Error checking pending actions:', error);
        }
      }
    };

    checkPendingActions();
    const interval = setInterval(checkPendingActions, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isOnline]);

  // Escuchar mensajes del Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'INSPECTION_SYNCED') {
          setPendingActions(prev => Math.max(0, prev - 1));
          setLastSync(new Date());
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  const capabilities = useMemo(() => {
    const canWork = isOnline || user?.role === 'operator'; // Operadores pueden trabajar offline
    
    return {
      canWork,
      canInstall: !!installPrompt && !isInstalled,
      hasNotifications: notificationPermission === 'granted',
      syncStatus: {
        isOnline,
        pendingActions,
        lastSync
      },
      offlineActions: pendingActions
    };
  }, [isOnline, user, installPrompt, isInstalled, notificationPermission, pendingActions, lastSync]);

  const installApp = async (): Promise<void> => {
    if (!installPrompt) {
      throw new Error('Install prompt not available');
    }

    try {
      const result = await installPrompt.prompt();
      console.log('Install prompt result:', result);
      
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallPrompt(null);
      }
    } catch (error) {
      console.error('Error during app installation:', error);
      throw error;
    }
  };

  const enableNotifications = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted' && 'serviceWorker' in navigator) {
        // Registrar para push notifications
        const registration = await navigator.serviceWorker.ready;
        
        if ('pushManager' in registration) {
          try {
            await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: null // Configurar con VAPID key si es necesario
            });
          } catch (pushError) {
            console.warn('Push notifications not available:', pushError);
          }
        }
      }

      return permission;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      throw error;
    }
  };

  const clearOfflineData = async (): Promise<void> => {
    try {
      if ('indexedDB' in window) {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase('TMSOfflineDB');
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      setPendingActions(0);
      setLastSync(null);
    } catch (error) {
      console.error('Error clearing offline data:', error);
      throw error;
    }
  };

  return {
    ...capabilities,
    installApp,
    enableNotifications,
    clearOfflineData
  };
};
