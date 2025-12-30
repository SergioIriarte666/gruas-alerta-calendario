
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import type { BeforeInstallPromptEvent } from '@/types/pwa';
import { openOfflineDatabase } from '@/services/offlineDb';

interface SyncStatus {
  isOnline: boolean;
  pendingActions: number;
  lastSync: Date | null;
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
  const { effectiveIsOnline, isForceOffline } = useOfflineMode();
  const [isOnline, setIsOnline] = useState(effectiveIsOnline);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [pendingActions, setPendingActions] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Sincronizar con effectiveIsOnline del contexto
  useEffect(() => {
    setIsOnline(effectiveIsOnline);
    
    // NOTE: We no longer trigger background sync from here
    // Data sync is handled by useOfflineSync with user's JWT
  }, [effectiveIsOnline, isForceOffline]);

  // Detectar install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
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

  // Monitorear acciones pendientes offline - using the CORRECT database
  useEffect(() => {
    const checkPendingActions = async () => {
      try {
        // Use the unified offline database
        const db = await openOfflineDatabase();
        
        if (db.objectStoreNames.contains('_offlineActions')) {
          const transaction = db.transaction('_offlineActions', 'readonly');
          const store = transaction.objectStore('_offlineActions');
          
          const count = await new Promise<number>((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => {
              // Count only pending/failed actions
              const actions = request.result || [];
              const pendingCount = actions.filter(
                (a: any) => a.status === 'pending' || a.status === 'failed'
              ).length;
              resolve(pendingCount);
            };
            request.onerror = () => resolve(0);
          });
          
          setPendingActions(count);
        }
      } catch (error) {
        console.error('Error checking pending actions:', error);
      }
    };

    checkPendingActions();
    const interval = setInterval(checkPendingActions, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline]);

  // Escuchar mensajes del Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'SYNC_COMPLETED') {
          // Refresh pending count after sync
          setPendingActions(0);
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
      
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
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
      // Clear the unified offline database
      if ('indexedDB' in window) {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase('tms-offline-cache');
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
