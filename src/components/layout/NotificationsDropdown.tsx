
import React from 'react';
import { Bell } from 'lucide-react';
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

export const NotificationsDropdown = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:text-black hover:bg-tms-green relative bg-tms-green/20 border border-tms-green/30"
        >
          <Bell className="w-5 h-5 text-tms-green" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-black border-tms-green/30 min-w-[350px] max-w-[400px] z-50 max-h-[400px] overflow-y-auto"
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold">Notificaciones</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-tms-green hover:bg-tms-green/20 text-xs"
              >
                Marcar todas como leídas
              </Button>
            )}
          </div>
          
          {notifications.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              No hay notificaciones
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 10).map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    notification.read 
                      ? 'bg-gray-800/50 border-gray-700' 
                      : 'bg-tms-green/10 border-tms-green/30'
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-white font-medium text-sm">{notification.title}</h4>
                    {!notification.read && (
                      <Badge className="bg-red-500 text-white text-xs px-1 py-0 h-4">
                        Nuevo
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-300 text-xs mb-2">{notification.message}</p>
                  <p className="text-gray-500 text-xs">
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
