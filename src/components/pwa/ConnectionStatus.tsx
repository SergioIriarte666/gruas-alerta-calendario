
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';

export const ConnectionStatus = () => {
  const { syncStatus, offlineActions } = usePWACapabilities();
  const { isOnline, pendingActions, lastSync } = syncStatus;

  if (isOnline && pendingActions === 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          En línea
        </Badge>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50 space-y-2">
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

  if (isOnline && pendingActions > 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Sincronizando... {pendingActions}
        </Badge>
      </div>
    );
  }

  return null;
};
