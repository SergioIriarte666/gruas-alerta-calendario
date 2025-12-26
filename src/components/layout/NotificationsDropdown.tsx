import React, { useMemo } from 'react';
import { Bell, X, ExternalLink, Check, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Notification, NotificationCategory, PRIORITY_CONFIG, CATEGORY_CONFIG } from '@/types/notifications';
import { useNotificationsSync } from '@/hooks/useNotificationsSync';
import { useNotificationsData } from '@/hooks/useNotificationsData';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export const NotificationsDropdown = () => {
  const navigate = useNavigate();
  
  const { 
    notifications: dbNotifications,
    markAsRead,
    markAllAsRead,
    dismissAllNotifications,
    unreadCount: dbUnreadCount,
    criticalCount,
  } = useNotificationsSync();
  
  const { notifications: generatedNotifications } = useNotificationsData();

  // Merge and deduplicate notifications
  const allNotifications = useMemo(() => {
    const dbIds = new Set(dbNotifications.map(n => n.id));
    const merged: Notification[] = [
      ...dbNotifications,
      ...generatedNotifications
        .filter(n => !dbIds.has(n.id))
        .map(n => ({
          ...n,
          read: false,
          category: (n.title.includes('Factura') ? 'invoices' :
                    n.title.includes('Servicio') ? 'services' :
                    n.title.includes('Documento') || n.title.includes('Grúa') ? 'documents' :
                    n.title.includes('Cierre') ? 'closures' : 'system') as NotificationCategory,
          priority: (n.type === 'error' ? 1 : n.type === 'warning' ? 2 : 4) as Notification['priority'],
        }))
    ];

    return merged
      .sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        if ((a.priority || 4) !== (b.priority || 4)) return (a.priority || 4) - (b.priority || 4);
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .slice(0, 8);
  }, [dbNotifications, generatedNotifications]);

  const unreadCount = allNotifications.filter(n => !n.read).length;
  const hasCritical = allNotifications.some(n => n.priority <= 2 && !n.read);

  const handleNavigate = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      navigate(notification.actionUrl, {
        state: notification.actionData ? { 
          filter: notification.actionData,
          fromNotification: true 
        } : undefined
      });
    } else {
      // Default navigation based on title
      if (notification.title.includes('Factura')) navigate('/invoices');
      else if (notification.title.includes('Servicio')) navigate('/services');
      else if (notification.title.includes('Documento') || notification.title.includes('Grúa')) navigate('/cranes');
      else if (notification.title.includes('Cierre')) navigate('/closures');
    }
  };

  const goToNotificationCenter = () => {
    navigate('/notifications');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            'relative bg-primary/20 border border-primary/30 hover:bg-primary/30',
            hasCritical && 'animate-pulse'
          )}
        >
          <Bell className="w-5 h-5 text-foreground" />
          {unreadCount > 0 && (
            <span className={cn(
              'absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold',
              hasCritical ? 'bg-red-500 text-white' : 'bg-destructive text-destructive-foreground'
            )}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-popover border-border w-[380px] max-w-[95vw] z-[99999]"
      >
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-foreground font-semibold">Notificaciones</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} nuevas
                </Badge>
              )}
              {hasCritical && (
                <Badge className="bg-red-500 text-white text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Urgentes
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-primary hover:bg-primary/20 text-xs h-7 px-2"
                  title="Marcar todas como leídas"
                >
                  <Check className="w-3 h-3" />
                </Button>
              )}
              {allNotifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={dismissAllNotifications}
                  className="text-destructive hover:bg-destructive/20 text-xs h-7 px-2"
                  title="Limpiar todas"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Notifications List */}
          {allNotifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
            </div>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="space-y-2 pr-2">
                {allNotifications.map((notification) => {
                  const priorityConfig = PRIORITY_CONFIG[notification.priority];
                  return (
                    <div 
                      key={notification.id}
                      onClick={() => handleNavigate(notification)}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-all duration-200 group',
                        notification.read 
                          ? 'bg-muted/30 border-border hover:bg-muted/50' 
                          : 'bg-primary/5 border-primary/20 hover:bg-primary/10',
                        notification.priority <= 2 && !notification.read && 'border-l-4 border-l-red-500'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={cn(
                              'text-sm font-medium truncate',
                              notification.read ? 'text-muted-foreground' : 'text-foreground'
                            )}>
                              {notification.title}
                            </h4>
                            {notification.priority <= 2 && (
                              <Badge className={cn('text-xs px-1.5 py-0', priorityConfig.bgColor, priorityConfig.color)}>
                                {priorityConfig.label}
                              </Badge>
                            )}
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            {format(notification.timestamp, 'dd/MM HH:mm', { locale: es })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          
          {/* Footer - View All */}
          <div className="pt-3 mt-3 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full text-sm"
              onClick={goToNotificationCenter}
            >
              <Bell className="w-4 h-4 mr-2" />
              Ver todas las notificaciones
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
