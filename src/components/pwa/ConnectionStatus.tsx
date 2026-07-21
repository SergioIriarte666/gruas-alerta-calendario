import React from 'react';
import { Badge } from '@/components/ui/badge';
import { WifiOff, RefreshCw } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';
export const ConnectionStatus = () => {
  const {
    syncStatus,
    offlineActions: _offlineActions
  } = usePWACapabilities();
  const {
    isOnline,
    pendingActions,
    lastSync: _lastSync
  } = syncStatus;
  if (isOnline && pendingActions === 0) {
    return <div className="fixed top-4 right-4 z-50">
        
      </div>;
  }
  if (!isOnline) {
    return <div className="fixed top-4 right-4 z-50 space-y-2">
        <Badge variant="outline" className="flex items-center gap-1 border-danger/30 bg-danger/20 text-danger-text animate-pulse">
          <WifiOff className="size-3" />
          Sin conexión
        </Badge>
        {pendingActions > 0 && <Badge variant="outline" className="flex items-center gap-1 border-warning/30 bg-warning/20 text-warning-text">
            <RefreshCw className="size-3" />
            {pendingActions} acciones pendientes
          </Badge>}
      </div>;
  }
  if (isOnline && pendingActions > 0) {
    return <div className="fixed top-4 right-4 z-50">
        <Badge variant="outline" className="flex items-center gap-1 border-info/30 bg-info/20 text-info-text">
          <RefreshCw className="size-3 animate-spin" />
          Sincronizando... {pendingActions}
        </Badge>
      </div>;
  }
  return null;
};
