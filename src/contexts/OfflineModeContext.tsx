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
}

const OfflineModeContext = createContext<OfflineModeContextType | undefined>(undefined);

const STORAGE_KEY = 'tms-force-offline-mode';

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

  const toggleForceOffline = useCallback(() => {
    setIsForceOffline(prev => !prev);
  }, []);

  const setForceOfflineValue = useCallback((value: boolean) => {
    setIsForceOffline(value);
  }, []);

  // Estado efectivo: offline si está forzado O si realmente no hay conexión
  const effectiveIsOnline = useMemo(() => {
    return realOnlineStatus && !isForceOffline;
  }, [realOnlineStatus, isForceOffline]);

  const value = useMemo(() => ({
    isForceOffline,
    effectiveIsOnline,
    toggleForceOffline,
    setForceOffline: setForceOfflineValue
  }), [isForceOffline, effectiveIsOnline, toggleForceOffline, setForceOfflineValue]);

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
