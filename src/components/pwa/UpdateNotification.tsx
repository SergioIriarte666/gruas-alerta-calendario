
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';

export const UpdateNotification = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const checkForUpdates = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setWaitingWorker(newWorker);
                    setShowUpdatePrompt(true);
                  }
                });
              }
            });

            // Check if there's already a waiting worker
            if (registration.waiting) {
              setWaitingWorker(registration.waiting);
              setShowUpdatePrompt(true);
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      };

      checkForUpdates();

      // Check for updates periodically
      const interval = setInterval(checkForUpdates, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      toast({
        type: 'success',
        title: 'Actualizando...',
        description: 'La aplicación se actualizará en unos segundos'
      });

      // Reload after a short delay to allow the new SW to take control
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    setShowUpdatePrompt(false);
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    
    toast({
      type: 'info',
      title: 'Actualización disponible',
      description: 'Puedes actualizar más tarde desde configuración'
    });
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm">
      <Card className="bg-slate-800/95 backdrop-blur-sm border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-sm">Nueva versión disponible</CardTitle>
                <CardDescription className="text-xs">
                  TMS Grúas se ha actualizado
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="text-gray-400 hover:text-white h-6 w-6"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Mejoras de rendimiento y nuevas funcionalidades disponibles.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="flex-1 text-gray-400 hover:text-white"
              >
                Más tarde
              </Button>
              <Button
                onClick={handleUpdate}
                size="sm"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Actualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
