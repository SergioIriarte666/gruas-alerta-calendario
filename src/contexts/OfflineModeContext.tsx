/**
 * Contexto para manejar modo offline forzado
 * Permite simular desconexión para pruebas sin desconectar la red real
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface OfflineModeContextType {
  isForceOffline: boolean;
  effectiveIsOnline: boolean;
  toggleForceOffline: () => void;
  setForceOffline: (value: boolean) => void;
  triggerOfflineHydration: () => void;
}

const OfflineModeContext = createContext<OfflineModeContextType | undefined>(undefined);

const STORAGE_KEY = 'tms-force-offline-mode';

// Custom event for triggering hydration across contexts
export const OFFLINE_HYDRATION_EVENT = 'tms-offline-hydration';

export const OfflineModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isForceOffline, setIsForceOffline] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [realOnlineStatus, setRealOnlineStatus] = useState(navigator.onLine);

  // Escuchar cambios reales de conexión
  useEffect(() => {
    const handleOnline = () => setRealOnlineStatus(true);
    const handleOffline = () => setRealOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persistir estado en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, isForceOffline.toString());
    } catch (error) {
      console.error('[OfflineMode] Error saving to localStorage:', error);
    }
  }, [isForceOffline]);

  // Dispatch hydration event when offline mode changes
  const triggerOfflineHydration = useCallback(() => {
    console.log('[OfflineMode] Triggering offline hydration event');
    window.dispatchEvent(new CustomEvent(OFFLINE_HYDRATION_EVENT));
  }, []);

  const toggleForceOffline = useCallback(() => {
    setIsForceOffline(prev => {
      const newValue = !prev;
      // Trigger hydration after state change
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(OFFLINE_HYDRATION_EVENT));
      }, 0);
      return newValue;
    });
  }, []);

  const setForceOfflineValue = useCallback((value: boolean) => {
    setIsForceOffline(value);
    // Trigger hydration after state change
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OFFLINE_HYDRATION_EVENT));
    }, 0);
  }, []);

  // Estado efectivo: offline si está forzado O si realmente no hay conexión
  const effectiveIsOnline = useMemo(() => {
    return realOnlineStatus && !isForceOffline;
  }, [realOnlineStatus, isForceOffline]);

  const value = useMemo(() => ({
    isForceOffline,
    effectiveIsOnline,
    toggleForceOffline,
    setForceOffline: setForceOfflineValue,
    triggerOfflineHydration
  }), [isForceOffline, effectiveIsOnline, toggleForceOffline, setForceOfflineValue, triggerOfflineHydration]);

  return (
    <OfflineModeContext.Provider value={value}>
      {children}
    </OfflineModeContext.Provider>
  );
};

export const useOfflineMode = (): OfflineModeContextType => {
  const context = useContext(OfflineModeContext);
  if (context === undefined) {
    throw new Error('useOfflineMode must be used within an OfflineModeProvider');
  }
  return context;
};

// Helper hook for components that might render before provider is available
export const useOfflineModeOptional = (): OfflineModeContextType | null => {
  const context = useContext(OfflineModeContext);
  return context ?? null;
};
