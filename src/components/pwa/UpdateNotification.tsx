
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Only run on client side and if service workers are supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.waitingWorker) {
        setWaitingWorker(customEvent.detail.waitingWorker);
        setShowUpdate(true);
      }
    };

    // Listen for update available events
    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border/70 bg-popover p-4 text-popover-foreground shadow-2xl">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Download className="size-5 text-primary" />
          <h3 className="font-semibold text-foreground">Actualización Disponible</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-auto p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Una nueva versión está disponible. Actualiza para obtener las últimas mejoras.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={handleUpdate}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Actualizar
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-accent"
        >
          Después
        </Button>
      </div>
    </div>
  );
};
