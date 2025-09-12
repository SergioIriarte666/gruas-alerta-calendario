
import React, { useState } from 'react';
import { Bell, X, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/contexts/NotificationContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Notification } from '@/types/notifications';

export const NotificationsDropdown = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAllNotifications } = useNotifications();
  const navigate = useNavigate();
  const [autoNavigateEnabled, setAutoNavigateEnabled] = useState(
    localStorage.getItem('notifications_auto_navigate') !== 'false'
  );

  const handleMarkAsRead = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    markAsRead(notificationId);
  };

  const handleNavigate = (notification: Notification) => {
    if (!autoNavigateEnabled) return;
    
    // Navegar según el tipo de acción
    if (notification.actionType === 'navigate' && notification.actionUrl) {
      if (notification.actionData) {
        navigate(notification.actionUrl, { 
          state: { 
            filter: notification.actionData,
            fromNotification: true 
          } 
        });
      } else {
        navigate(notification.actionUrl);
      }
    } else if (notification.actionType === 'filter' && notification.actionData?.filter) {
      const filterType = notification.actionData.filter;
      
      switch (filterType) {
        case 'pending-services':
          navigate('/closures', { 
            state: { 
              filter: { status: 'pending' },
              fromNotification: true 
            } 
          });
          break;
        case 'critical-services':
          navigate('/services', { 
            state: { 
              filter: { status: 'critical' },
              fromNotification: true 
            } 
          });
          break;
        case 'overdue-invoices':
          navigate('/invoices', { 
            state: { 
              filter: { status: 'overdue' },
              fromNotification: true 
            } 
          });
          break;
        case 'expiring-documents':
          navigate('/cranes', { 
            state: { 
              filter: { expiring: true },
              fromNotification: true 
            } 
          });
          break;
        case 'old-services':
        case 'ancient-services':
          navigate('/closures', { 
            state: { 
              filter: { status: 'old' },
              fromNotification: true 
            } 
          });
          break;
        default:
          if (notification.title.includes('Servicio')) {
            navigate('/services');
          } else if (notification.title.includes('Factura')) {
            navigate('/invoices');
          } else if (notification.title.includes('Documento')) {
            navigate('/cranes');
          } else if (notification.title.includes('Cierre')) {
            navigate('/closures');
          }
      }
    } else {
      if (notification.title.includes('Antiguos Sin Cierre') || notification.title.includes('Sin Cierre')) {
        navigate('/closures', { 
          state: { 
            filter: { status: 'old' },
            fromNotification: true 
          } 
        });
      } else if (notification.title.includes('Servicio')) {
        navigate('/services');
      } else if (notification.title.includes('Factura')) {
        navigate('/invoices');
      } else if (notification.title.includes('Documento') || notification.title.includes('Grúa')) {
        navigate('/cranes');
      } else if (notification.title.includes('Cierre')) {
        navigate('/closures');
      } else if (notification.title.includes('Costo')) {
        navigate('/costs');
      }
    }
  };

  const toggleAutoNavigate = () => {
    const newValue = !autoNavigateEnabled;
    setAutoNavigateEnabled(newValue);
    localStorage.setItem('notifications_auto_navigate', newValue.toString());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-foreground hover:text-primary-foreground hover:bg-primary relative bg-primary/20 border border-primary/30"
        >
          <Bell className="w-5 h-5 text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full text-xs flex items-center justify-center text-destructive-foreground font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-popover border-border min-w-[380px] max-w-[420px] z-[99999] max-h-[450px] overflow-hidden"
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-foreground font-semibold">Notificaciones</h3>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleAutoNavigate}
                className={`text-xs ${autoNavigateEnabled ? 'text-primary' : 'text-muted-foreground'} hover:bg-primary/20 px-2`}
                title={autoNavigateEnabled ? 'Deshabilitar navegación automática' : 'Habilitar navegación automática'}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
              {notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllNotifications}
                  className="text-destructive hover:bg-destructive/20 text-xs px-2"
                  title="Limpiar todas las notificaciones"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-primary hover:bg-primary/20 text-xs px-2"
                  title="Marcar todas como leídas"
                >
                  <Check className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          {notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No hay notificaciones
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {notifications.slice(0, 15).map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-all duration-200 ${
                    notification.read 
                      ? 'bg-muted/50 border-border' 
                      : 'bg-primary/10 border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-foreground font-medium text-sm pr-2 flex-1">{notification.title}</h4>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.read && (
                        <Badge className="bg-destructive text-destructive-foreground text-xs px-1 py-0 h-4">
                          Nuevo
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        onClick={(e) => handleMarkAsRead(e, notification.id)}
                        title="Marcar como leída"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      {autoNavigateEnabled && (notification.actionUrl || notification.actionType) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-primary hover:text-primary-foreground hover:bg-primary/20"
                          onClick={() => handleNavigate(notification)}
                          title="Ir a la sección"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs mb-2">{notification.message}</p>
                  <p className="text-muted-foreground/70 text-xs">
                    {format(notification.timestamp, 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
