
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNotifications } from '@/contexts/NotificationContext';
import { AlertTriangle, Clock, FileText, DollarSign, Truck, Calendar, User, Receipt, X } from 'lucide-react';
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

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'default';
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Show only the first 5 most recent notifications in the dashboard
  const displayNotifications = notifications.slice(0, 5);

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm h-fit">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-x-3 text-black text-xl">
            <div className="p-2 bg-tms-green/10 rounded-lg">
              <AlertTriangle className="size-6 text-tms-green" />
            </div>
            <span>Alertas y Recordatorios</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-black text-xl">
          <div className="flex items-center gap-x-3">
            <div className="p-2 bg-tms-green/10 rounded-lg">
              <AlertTriangle className="size-6 text-tms-green" />
            </div>
            <span>Alertas y Recordatorios</span>
          </div>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayNotifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="p-4 bg-gray-50 rounded-xl inline-block mb-4">
              <Clock className="size-12 mx-auto text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg">No hay alertas pendientes</p>
            <p className="text-gray-500 text-sm mt-2">Las alertas aparecerán aquí cuando se programen eventos importantes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayNotifications.map((notification) => {
              const Icon = getAlertIcon(notification.title);
              return (
                <Alert 
                  key={notification.id} 
                  variant={getAlertVariant(notification.type)}
                  className="bg-gray-50 border-gray-200 p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-x-3">
                    <Icon className="size-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="gap-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-black">{notification.title}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${getAlertBadgeColor(notification.type)}`}>
                              {notification.type === 'error' ? 'Urgente' : 
                               notification.type === 'warning' ? 'Importante' : 'Info'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{notification.message}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-4 font-medium">
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
                  className="text-sm text-gray-500 hover:text-gray-700"
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-x-3">
                <div className="p-2 bg-tms-green/10 rounded-lg">
                  <AlertTriangle className="size-6 text-tms-green" />
                </div>
                <span>Todas las Alertas y Recordatorios</span>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
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
                <div className="p-4 bg-gray-50 rounded-xl inline-block mb-4">
                  <Clock className="size-12 mx-auto text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg">No hay alertas pendientes</p>
                <p className="text-gray-500 text-sm mt-2">Las alertas aparecerán aquí cuando se programen eventos importantes</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getAlertIcon(notification.title);
                return (
                  <Alert 
                    key={notification.id} 
                    variant={getAlertVariant(notification.type)}
                    className={`${notification.read ? 'bg-gray-50 opacity-75' : 'bg-white'} border-gray-200 p-4 hover:bg-gray-100 transition-colors cursor-pointer`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-x-3">
                      <Icon className="size-5 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="gap-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold text-sm ${notification.read ? 'text-gray-500' : 'text-black'}`}>
                                {notification.title}
                              </p>
                              <span className={`text-xs px-2 py-1 rounded-full ${getAlertBadgeColor(notification.type)}`}>
                                {notification.type === 'error' ? 'Urgente' : 
                                 notification.type === 'warning' ? 'Importante' : 'Info'}
                              </span>
                              {!notification.read && (
                                <span className="size-2 bg-blue-500 rounded-full"></span>
                              )}
                            </div>
                            <p className={`text-sm leading-relaxed ${notification.read ? 'text-gray-500' : 'text-gray-600'}`}>
                              {notification.message}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-4 font-medium">
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
