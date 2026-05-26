import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNotifications } from '@/contexts/NotificationContext';
import { AlertTriangle, Clock, FileText, DollarSign, Truck, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const AlertsPanel = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [showAllModal, setShowAllModal] = useState(false);

  const getAlertIcon = (title: string) => {
    if (title.includes('Servicio')) return Truck;
    if (title.includes('Factura')) return Receipt;
    if (title.includes('Documento') || title.includes('Examen')) return FileText;
    if (title.includes('Cierre')) return DollarSign;
    return AlertTriangle;
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'outline';
    }
  };

  // Show only the first 5 most recent notifications in the dashboard
  const displayNotifications = notifications.slice(0, 5);

  if (loading) {
    return (
      <Card className="h-fit border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-x-3 text-xl text-foreground">
            <div className="rounded-xl bg-warning/10 p-2 text-warning">
              <AlertTriangle className="size-5" />
            </div>
            <span>Alertas y Recordatorios</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-xl text-foreground">
          <div className="flex items-center gap-x-3">
            <div className="rounded-xl bg-warning/10 p-2 text-warning">
              <AlertTriangle className="size-5" />
            </div>
            <span>Alertas y Recordatorios</span>
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-destructive px-2 py-1 text-xs text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayNotifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="mb-4 inline-flex rounded-2xl bg-muted p-4">
              <Clock className="mx-auto size-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">No hay alertas pendientes</p>
            <p className="mt-2 text-sm text-muted-foreground">Las alertas aparecerán aquí cuando se programen eventos importantes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayNotifications.map((notification) => {
              const Icon = getAlertIcon(notification.title);
              return (
                <Alert 
                  key={notification.id} 
                  className="cursor-pointer rounded-2xl border-border/70 bg-background/70 p-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-start gap-x-3">
                    <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <Icon className="mt-0.5 size-4 flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="gap-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                            <Badge variant={getAlertBadgeColor(notification.type) as any}>
                              {notification.type === 'error' ? 'Urgente' : 
                               notification.type === 'warning' ? 'Importante' : 'Info'}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
                        </div>
                        <span className="ml-4 whitespace-nowrap text-xs font-medium text-muted-foreground">
                          {format(notification.timestamp, 'dd MMM', { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Alert>
              );
            })}
            {notifications.length > 5 && (
              <div className="text-center pt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAllModal(true)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Y {notifications.length - 5} alertas más...
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Modal para mostrar todas las alertas */}
      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-hidden border-border/70 bg-popover/95">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-x-3">
                <div className="rounded-xl bg-warning/10 p-2 text-warning">
                  <AlertTriangle className="size-5" />
                </div>
                <span>Todas las Alertas y Recordatorios</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-destructive px-2 py-1 text-xs text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead()}
                className="text-xs"
              >
                Marcar todas como leídas
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-2">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-4 inline-flex rounded-2xl bg-muted p-4">
                  <Clock className="mx-auto size-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground">No hay alertas pendientes</p>
                <p className="mt-2 text-sm text-muted-foreground">Las alertas aparecerán aquí cuando se programen eventos importantes.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getAlertIcon(notification.title);
                return (
                  <Alert 
                    key={notification.id} 
                    className={`${notification.read ? 'bg-muted/40 opacity-75' : 'bg-background/80'} cursor-pointer rounded-2xl border-border/70 p-4 transition-colors hover:bg-accent/40`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-x-3">
                      <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                        <Icon className="mt-0.5 size-4 flex-shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="gap-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-semibold ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {notification.title}
                              </p>
                              <Badge variant={getAlertBadgeColor(notification.type) as any}>
                                {notification.type === 'error' ? 'Urgente' : 
                                 notification.type === 'warning' ? 'Importante' : 'Info'}
                              </Badge>
                              {!notification.read && (
                                <span className="size-2 rounded-full bg-primary"></span>
                              )}
                            </div>
                            <p className={`text-sm leading-relaxed ${notification.read ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                              {notification.message}
                            </p>
                          </div>
                          <span className="ml-4 whitespace-nowrap text-xs font-medium text-muted-foreground">
                            {format(notification.timestamp, 'dd MMM HH:mm', { locale: es })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Alert>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
