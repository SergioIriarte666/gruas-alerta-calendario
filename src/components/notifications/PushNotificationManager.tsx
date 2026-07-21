
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PushNotificationManager");
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
        <div className="rounded-xl border border-warning/20 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-warning" />
            <div>
              <h3 className="font-medium text-foreground">Notificaciones Push No Disponibles</h3>
              <p className="text-sm text-muted-foreground">
                {getUnsupportedReason()}
              </p>
              {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Las notificaciones push requieren HTTPS en producción.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    if (isLoading) {
      logger.debug('Already processing subscription...');
      return;
    }

    try {
      logger.debug('Starting subscription process...');
      
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
      logger.error('Subscription error:', error);
      toast.error('Error de configuración', {
        description: 'Error al configurar notificaciones. Revisa la consola para más detalles.'
      });
    }
  };

  const handleUnsubscribe = async () => {
    if (isLoading) {
      logger.debug('Already processing unsubscription...');
      return;
    }

    try {
      logger.debug('Starting unsubscription process...');
      
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
      logger.error('Unsubscription error:', error);
      toast.error('Error', {
        description: 'Error al deshabilitar notificaciones. Intenta de nuevo.'
      });
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { icon: CheckCircle, text: 'Permitido', color: 'text-success' };
      case 'denied':
        return { icon: BellOff, text: 'Bloqueado', color: 'text-danger' };
      default:
        return { icon: Bell, text: 'Pendiente', color: 'text-warning' };
    }
  };

  const permissionStatus = getPermissionStatus();
  const PermissionIcon = permissionStatus.icon;

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              <Smartphone className="size-3.5" />
              Push en tiempo real
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Estado: {permissionStatus.text}
            </Badge>
          </div>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Smartphone className="size-5" />
            Estado de Notificaciones Push
          </CardTitle>
          <CardDescription>
            Gestiona permisos del navegador, suscripción activa y preferencias de notificaciones push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center gap-3">
              <PermissionIcon className={`size-5 ${permissionStatus.color}`} />
              <div>
                <p className="font-medium text-foreground">Estado: {permissionStatus.text}</p>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed ? 'Suscrito y recibiendo notificaciones' : 'No suscrito'}
                </p>
                {error && (
                  <p className="text-xs text-destructive mt-1">
                    Error: {error.substring(0, 100)}{error.length > 100 ? '...' : ''}
                  </p>
                )}
              </div>
            </div>
            
            {permission === 'default' && (
              <Button
                onClick={requestPermission}
                disabled={isLoading}
              >
                Solicitar Permisos
              </Button>
            )}
            
            {permission === 'granted' && !isSubscribed && (
              <Button
                onClick={handleSubscribe}
                disabled={isLoading}
              >
                {isLoading ? 'Habilitando...' : 'Habilitar'}
              </Button>
            )}
            
            {permission === 'granted' && isSubscribed && (
              <Button
                onClick={handleUnsubscribe}
                disabled={isLoading}
                variant="outline"
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
                className="border-warning/30 bg-background/60 text-warning hover:bg-warning/10"
              >
                <RefreshCw className="size-4 mr-1" />
                Reintentar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isSubscribed && (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Preferencias de Notificación</CardTitle>
            <CardDescription>
              Define qué eventos deben disparar notificaciones push para este dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
                <div>
                  <Label htmlFor="newServices" className="text-foreground">
                    Nuevos Servicios Asignados
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Recibe avisos cuando se te asignen nuevos servicios.
                  </p>
                </div>
                <Switch
                  id="newServices"
                  checked={preferences.newServices}
                  onCheckedChange={(checked) => updatePreferences({ newServices: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
                <div>
                  <Label htmlFor="serviceUpdates" className="text-foreground">
                    Actualizaciones de Servicios
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Notifica cambios relevantes en el avance o estado de los servicios.
                  </p>
                </div>
                <Switch
                  id="serviceUpdates"
                  checked={preferences.serviceUpdates}
                  onCheckedChange={(checked) => updatePreferences({ serviceUpdates: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
                <div>
                  <Label htmlFor="inspectionCompleted" className="text-foreground">
                    Inspecciones Completadas
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Informa cuando una inspección quede cerrada correctamente.
                  </p>
                </div>
                <Switch
                  id="inspectionCompleted"
                  checked={preferences.inspectionCompleted}
                  onCheckedChange={(checked) => updatePreferences({ inspectionCompleted: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
                <div>
                  <Label htmlFor="invoiceGenerated" className="text-foreground">
                    Facturas Generadas
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Notifica la emisión de nuevas facturas relacionadas con la operación.
                  </p>
                </div>
                <Switch
                  id="invoiceGenerated"
                  checked={preferences.invoiceGenerated}
                  onCheckedChange={(checked) => updatePreferences({ invoiceGenerated: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
                <div>
                  <Label htmlFor="systemAlerts" className="text-foreground">
                    Alertas del Sistema
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Muestra incidencias, caídas o eventos críticos del sistema.
                  </p>
                </div>
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
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 text-danger" />
            <div>
              <h3 className="mb-2 font-medium text-danger">Notificaciones Bloqueadas</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Has bloqueado las notificaciones para este sitio. Para habilitarlas:
              </p>
              <ol className="ml-4 space-y-1 text-sm text-muted-foreground">
                <li>1. Haz clic en el ícono de candado en la barra de direcciones</li>
                <li>2. Cambia &quot;Notificaciones&quot; a &quot;Permitir&quot;</li>
                <li>3. Recarga la página</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
