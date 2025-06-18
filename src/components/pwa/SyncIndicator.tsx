
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';
import type { ServiceWorkerRegistrationWithSync } from '@/types/pwa';

export const SyncIndicator = () => {
  const { syncStatus, offlineActions } = usePWACapabilities();
  const [showDetails, setShowDetails] = useState(false);
  const [syncHistory, setSyncHistory] = useState<Array<{ time: Date; success: boolean; count: number }>>([]);

  useEffect(() => {
    if (syncStatus.lastSync) {
      setSyncHistory(prev => [
        ...prev.slice(-4), // Keep last 5 entries
        {
          time: syncStatus.lastSync!,
          success: true,
          count: offlineActions
        }
      ]);
    }
  }, [syncStatus.lastSync, offlineActions]);

  const handleManualSync = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const syncRegistration = registration as ServiceWorkerRegistrationWithSync;
        
        if ('sync' in syncRegistration && syncRegistration.sync) {
          await syncRegistration.sync.register('offline-action');
          console.log('Manual sync triggered');
        } else {
          console.warn('Background sync not supported');
        }
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  if (syncStatus.isOnline && offlineActions === 0 && !showDetails) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!showDetails ? (
        <Badge
          className="bg-slate-800/90 backdrop-blur-sm text-white border border-slate-700 cursor-pointer hover:bg-slate-700/90 transition-colors"
          onClick={() => setShowDetails(true)}
        >
          {syncStatus.isOnline ? (
            offlineActions > 0 ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Sincronizando {offlineActions}
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 mr-1 text-green-400" />
                Sincronizado
              </>
            )
          ) : (
            <>
              <AlertCircle className="w-3 h-3 mr-1 text-yellow-400" />
              Offline - {offlineActions} pendientes
            </>
          )}
        </Badge>
      ) : (
        <Card className="w-80 bg-slate-800/95 backdrop-blur-sm border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm">Estado de Sincronización</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-white h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            <CardDescription>
              {syncStatus.isOnline ? 'Conectado' : 'Sin conexión'} • {offlineActions} acciones pendientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {offlineActions > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Acciones pendientes:</span>
                  <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    {offlineActions}
                  </Badge>
                </div>
                {syncStatus.isOnline && (
                  <Button
                    onClick={handleManualSync}
                    size="sm"
                    className="w-full bg-tms-green hover:bg-tms-green/90 text-slate-900"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Sincronizar ahora
                  </Button>
                )}
              </div>
            )}
            
            {syncHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Historial reciente:</h4>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {syncHistory.slice().reverse().map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3 h-3" />
                        {entry.time.toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.success ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-red-400" />
                        )}
                        <span className="text-gray-400">{entry.count} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {syncStatus.lastSync && (
              <div className="text-xs text-gray-400 pt-2 border-t border-slate-700">
                Última sync: {syncStatus.lastSync.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
