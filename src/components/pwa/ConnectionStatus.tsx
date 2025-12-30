import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, FlaskConical } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';
import { useOfflineMode } from '@/contexts/OfflineModeContext';

export const ConnectionStatus = () => {
  const {
    syncStatus,
    offlineActions
  } = usePWACapabilities();
  const {
    isOnline,
    pendingActions,
    lastSync
  } = syncStatus;
  
  const { isForceOffline, toggleForceOffline } = useOfflineMode();

  // Modo offline forzado (prueba)
  if (isForceOffline) {
    return (
      <div className="fixed top-20 right-4 z-50 space-y-2">
        <Badge
          className="bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 transition-colors"
          onClick={toggleForceOffline}
          title="Click para desactivar modo prueba"
        >
          <FlaskConical className="w-3 h-3" />
          Modo Offline (Prueba)
        </Badge>
        {pendingActions > 0 && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {pendingActions} acciones pendientes
          </Badge>
        )}
      </div>
    );
  }

  // Conectado sin acciones pendientes - no mostrar nada
  if (isOnline && pendingActions === 0) {
    return null;
  }

  // Sin conexión real
  if (!isOnline) {
    return (
      <div className="fixed top-20 right-4 z-50 space-y-2">
        <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
          <WifiOff className="w-3 h-3" />
          Sin conexión
        </Badge>
        {pendingActions > 0 && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {pendingActions} acciones pendientes
          </Badge>
        )}
      </div>
    );
  }

  // Conectado con acciones pendientes (sincronizando)
  if (isOnline && pendingActions > 0) {
    return (
      <div className="fixed top-20 right-4 z-50">
        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Sincronizando... {pendingActions}
        </Badge>
      </div>
    );
  }

  return null;
};