
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
    <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg max-w-sm z-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-tms-green" />
          <h3 className="font-semibold text-white">Actualización Disponible</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 h-auto"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-slate-300 text-sm mb-3">
        Una nueva versión está disponible. Actualiza para obtener las últimas mejoras.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={handleUpdate}
          size="sm"
          className="bg-tms-green hover:bg-tms-green-dark text-white"
        >
          Actualizar
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Después
        </Button>
      </div>
    </div>
  );
};
