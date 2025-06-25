
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, Smartphone, Check, X } from 'lucide-react';

export const PushNotificationManager: React.FC = () => {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    requestPermission
  } = usePushNotifications();

  const [preferences, setPreferences] = useState({
    newServices: true,
    serviceUpdates: true,
    inspectionCompleted: true,
    invoiceGenerated: false,
    systemAlerts: true
  });

  const handleToggleSubscription = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch (error) {
      console.error('Error toggling push notification subscription:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      await requestPermission();
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><Check className="w-3 h-3 mr-1" />Permitido</Badge>;
      case 'denied':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Denegado</Badge>;
      default:
        return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  if (!isSupported) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Notificaciones Push No Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">
            Tu navegador no soporta notificaciones push o no estás usando HTTPS.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Configuración de Notificaciones Push
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Estado de Permisos</Label>
              <p className="text-sm text-slate-400">
                Permisos del navegador para mostrar notificaciones
              </p>
            </div>
            {getPermissionBadge()}
          </div>

          {permission === 'default' && (
            <Button 
              onClick={handleRequestPermission}
              className="w-full"
              variant="outline"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Solicitar Permisos de Notificación
            </Button>
          )}

          {permission === 'granted' && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Notificaciones Push</Label>
                <p className="text-sm text-slate-400">
                  {isSubscribed ? 'Recibiendo notificaciones' : 'No está suscrito'}
                </p>
              </div>
              <Button
                onClick={handleToggleSubscription}
                disabled={isLoading}
                variant={isSubscribed ? "destructive" : "default"}
              >
                {isLoading ? (
                  'Procesando...'
                ) : isSubscribed ? (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Deshabilitar
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Habilitar
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isSubscribed && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>Preferencias de Notificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="newServices">Nuevos Servicios Asignados</Label>
                  <p className="text-sm text-slate-400">
                    Cuando te asignen un nuevo servicio
                  </p>
                </div>
                <Switch
                  id="newServices"
                  checked={preferences.newServices}
                  onCheckedChange={(checked) =>
                    setPreferences(prev => ({ ...prev, newServices: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="serviceUpdates">Actualizaciones de Servicios</Label>
                  <p className="text-sm text-slate-400">
                    Cambios de estado en servicios
                  </p>
                </div>
                <Switch
                  id="serviceUpdates"
                  checked={preferences.serviceUpdates}
                  onCheckedChange={(checked) =>
                    setPreferences(prev => ({ ...prev, serviceUpdates: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="inspectionCompleted">Inspecciones Completadas</Label>
                  <p className="text-sm text-slate-400">
                    Cuando se complete una inspección
                  </p>
                </div>
                <Switch
                  id="inspectionCompleted"
                  checked={preferences.inspectionCompleted}
                  onCheckedChange={(checked) =>
                    setPreferences(prev => ({ ...prev, inspectionCompleted: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="invoiceGenerated">Facturas Generadas</Label>
                  <p className="text-sm text-slate-400">
                    Cuando se genere una nueva factura
                  </p>
                </div>
                <Switch
                  id="invoiceGenerated"
                  checked={preferences.invoiceGenerated}
                  onCheckedChange={(checked) =>
                    setPreferences(prev => ({ ...prev, invoiceGenerated: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="systemAlerts">Alertas del Sistema</Label>
                  <p className="text-sm text-slate-400">
                    Vencimientos y alertas importantes
                  </p>
                </div>
                <Switch
                  id="systemAlerts"
                  checked={preferences.systemAlerts}
                  onCheckedChange={(checked) =>
                    setPreferences(prev => ({ ...prev, systemAlerts: checked }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
