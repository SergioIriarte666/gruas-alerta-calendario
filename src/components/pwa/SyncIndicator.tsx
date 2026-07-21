
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { usePWACapabilities } from '@/hooks/usePWACapabilities';
import type { ServiceWorkerRegistrationWithSync } from '@/types/pwa';
import { createLogger } from "@/lib/logger";


const logger = createLogger("SyncIndicator");
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
          logger.debug('Manual sync triggered');
        } else {
          logger.warn('Background sync not supported');
        }
      } catch (error) {
        logger.error('Manual sync failed:', error);
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
          variant="outline"
          className="cursor-pointer border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-sm transition-colors hover:bg-accent"
          onClick={() => setShowDetails(true)}
        >
          {syncStatus.isOnline ? (
            offlineActions > 0 ? (
              <>
                <RefreshCw className="size-3 mr-1 animate-spin" />
                Sincronizando {offlineActions}
              </>
            ) : (
              <>
                <CheckCircle className="size-3 mr-1 text-success" />
                Sincronizado
              </>
            )
          ) : (
            <>
              <AlertCircle className="size-3 mr-1 text-warning" />
              Offline - {offlineActions} pendientes
            </>
          )}
        </Badge>
      ) : (
        <Card className="w-80 border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground">Estado de Sincronización</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
                className="size-6 p-0 text-muted-foreground hover:text-foreground"
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
                  <span className="text-muted-foreground">Acciones pendientes:</span>
                  <Badge variant="outline" className="border-warning/30 bg-warning/20 text-warning-text">
                    {offlineActions}
                  </Badge>
                </div>
                {syncStatus.isOnline && (
                  <Button
                    onClick={handleManualSync}
                    size="sm"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Sincronizar ahora
                  </Button>
                )}
              </div>
            )}
            
            {syncHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Historial reciente:</h4>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {syncHistory.slice().reverse().map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3" />
                        {entry.time.toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.success ? (
                          <CheckCircle className="size-3 text-success" />
                        ) : (
                          <AlertCircle className="size-3 text-danger" />
                        )}
                        <span className="text-muted-foreground">{entry.count} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {syncStatus.lastSync && (
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                Última sync: {syncStatus.lastSync.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
