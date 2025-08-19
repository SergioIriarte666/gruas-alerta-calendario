
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export const PushNotificationManager: React.FC = () => {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
    updatePreferences,
    retry,
  } = usePushNotifications();

  if (!isSupported) {
    const getUnsupportedReason = () => {
      if (typeof window === 'undefined') return 'Entorno no compatible';
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        return 'Se requiere HTTPS para notificaciones push';
      }
      if (!('serviceWorker' in navigator)) return 'Service Workers no soportados';
      if (!('PushManager' in window)) return 'Push API no soportada';
      if (!('Notification' in window)) return 'API de Notificaciones no soportada';
      return 'Navegador en modo incógnito o características deshabilitadas';
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-lg border border-slate-700">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="font-medium text-white">Notificaciones Push No Disponibles</h3>
            <p className="text-sm text-slate-400">
              {getUnsupportedReason()}
            </p>
            {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && (
              <p className="text-xs text-slate-500 mt-1">
                Las notificaciones push requieren HTTPS en producción.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    if (isLoading) {
      console.log('Already processing subscription...');
      return;
    }

    try {
      console.log('Starting subscription process...');
      
      // Additional environment checks
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        toast.error('HTTPS requerido', {
          description: 'Las notificaciones push requieren una conexión segura (HTTPS).'
        });
        return;
      }

      const success = await subscribe();
      if (success) {
        toast.success('¡Notificaciones habilitadas!', {
          description: 'Recibirás notificaciones push en tiempo real.'
        });
      } else {
        toast.error('Error al habilitar', {
          description: 'No se pudieron habilitar las notificaciones. Verifica los permisos del navegador.'
        });
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Error de configuración', {
        description: 'Error al configurar notificaciones. Revisa la consola para más detalles.'
      });
    }
  };

  const handleUnsubscribe = async () => {
    if (isLoading) {
      console.log('Already processing unsubscription...');
      return;
    }

    try {
      console.log('Starting unsubscription process...');
      
      const success = await unsubscribe();
      if (success) {
        toast.success('Notificaciones deshabilitadas', {
          description: 'Ya no recibirás notificaciones push.'
        });
      } else {
        toast.error('Error al deshabilitar', {
          description: 'No se pudieron deshabilitar completamente las notificaciones.'
        });
      }
    } catch (error) {
      console.error('Unsubscription error:', error);
      toast.error('Error', {
        description: 'Error al deshabilitar notificaciones. Intenta de nuevo.'
      });
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { icon: CheckCircle, text: 'Permitido', color: 'text-green-500' };
      case 'denied':
        return { icon: BellOff, text: 'Bloqueado', color: 'text-red-500' };
      default:
        return { icon: Bell, text: 'Pendiente', color: 'text-amber-500' };
    }
  };

  const permissionStatus = getPermissionStatus();
  const PermissionIcon = permissionStatus.icon;

  return (
    <div className="space-y-6">
      {/* Estado de las Notificaciones */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Smartphone className="w-5 h-5" />
            Estado de Notificaciones Push
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PermissionIcon className={`w-5 h-5 ${permissionStatus.color}`} />
              <div>
                <p className="font-medium text-white">Estado: {permissionStatus.text}</p>
                <p className="text-sm text-slate-400">
                  {isSubscribed ? 'Suscrito y recibiendo notificaciones' : 'No suscrito'}
                </p>
                {error && (
                  <p className="text-xs text-red-400 mt-1">
                    Error: {error.substring(0, 100)}{error.length > 100 ? '...' : ''}
                  </p>
                )}
              </div>
            </div>
            
            {permission === 'default' && (
              <Button
                onClick={requestPermission}
                disabled={isLoading}
                className="bg-tms-green hover:bg-tms-green-dark"
              >
                Solicitar Permisos
              </Button>
            )}
            
            {permission === 'granted' && !isSubscribed && (
              <Button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="bg-tms-green hover:bg-tms-green-dark"
              >
                {isLoading ? 'Habilitando...' : 'Habilitar'}
              </Button>
            )}
            
            {permission === 'granted' && isSubscribed && (
              <Button
                onClick={handleUnsubscribe}
                disabled={isLoading}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {isLoading ? 'Deshabilitando...' : 'Deshabilitar'}
              </Button>
            )}
            
            {error && (
              <Button
                onClick={retry}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="border-amber-600 text-amber-300 hover:bg-amber-900/20"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferencias de Notificación */}
      {isSubscribed && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Preferencias de Notificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="newServices" className="text-slate-300">
                  Nuevos Servicios Asignados
                </Label>
                <Switch
                  id="newServices"
                  checked={preferences.newServices}
                  onCheckedChange={(checked) => updatePreferences({ newServices: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="serviceUpdates" className="text-slate-300">
                  Actualizaciones de Servicios
                </Label>
                <Switch
                  id="serviceUpdates"
                  checked={preferences.serviceUpdates}
                  onCheckedChange={(checked) => updatePreferences({ serviceUpdates: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="inspectionCompleted" className="text-slate-300">
                  Inspecciones Completadas
                </Label>
                <Switch
                  id="inspectionCompleted"
                  checked={preferences.inspectionCompleted}
                  onCheckedChange={(checked) => updatePreferences({ inspectionCompleted: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="invoiceGenerated" className="text-slate-300">
                  Facturas Generadas
                </Label>
                <Switch
                  id="invoiceGenerated"
                  checked={preferences.invoiceGenerated}
                  onCheckedChange={(checked) => updatePreferences({ invoiceGenerated: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="systemAlerts" className="text-slate-300">
                  Alertas del Sistema
                </Label>
                <Switch
                  id="systemAlerts"
                  checked={preferences.systemAlerts}
                  onCheckedChange={(checked) => updatePreferences({ systemAlerts: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {permission === 'denied' && (
        <div className="p-4 bg-red-950 border border-red-800 rounded-lg">
          <h3 className="font-medium text-red-200 mb-2">Notificaciones Bloqueadas</h3>
          <p className="text-sm text-red-300 mb-3">
            Has bloqueado las notificaciones para este sitio. Para habilitarlas:
          </p>
          <ol className="text-sm text-red-300 space-y-1 ml-4">
            <li>1. Haz clic en el ícono de candado en la barra de direcciones</li>
            <li>2. Cambia "Notificaciones" a "Permitir"</li>
            <li>3. Recarga la página</li>
          </ol>
        </div>
      )}
    </div>
  );
};
