import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, X, ExternalLink, AlertTriangle, Clock, FileText, Truck, Settings, CheckCircle, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notification, PRIORITY_CONFIG, NotificationCategory } from '@/types/notifications';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (notification: Notification) => void;
  compact?: boolean;
}

const CategoryIcons: Record<NotificationCategory, React.ElementType> = {
  services: Truck,
  invoices: FileText,
  documents: FileWarning,
  closures: CheckCircle,
  system: Settings,
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onNavigate,
  compact = false,
}) => {
  const priorityConfig = PRIORITY_CONFIG[notification.priority];
  const CategoryIcon = CategoryIcons[notification.category] || Settings;

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    onNavigate(notification);
  };

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer',
        notification.read
          ? 'bg-muted/30 border-border hover:bg-muted/50'
          : 'bg-primary/5 border-primary/20 hover:bg-primary/10',
        notification.priority <= 2 && !notification.read && 'border-l-4 border-l-red-500'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          notification.type === 'error' ? 'bg-red-100 text-red-600' :
          notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
          notification.type === 'success' ? 'bg-green-100 text-green-600' :
          'bg-blue-100 text-blue-600'
        )}>
          <CategoryIcon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={cn(
                  'text-sm font-medium truncate',
                  notification.read ? 'text-muted-foreground' : 'text-foreground'
                )}>
                  {notification.title}
                </h4>
                
                {/* Priority Badge */}
                {notification.priority <= 2 && (
                  <Badge className={cn('text-xs px-1.5 py-0', priorityConfig.bgColor, priorityConfig.color)}>
                    {priorityConfig.label}
                  </Badge>
                )}
                
                {/* Unread Badge */}
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </div>
              
              <p className={cn(
                'text-xs mb-1',
                notification.read ? 'text-muted-foreground/70' : 'text-muted-foreground',
                compact && 'line-clamp-1'
              )}>
                {notification.message}
              </p>
              
              {/* Group count if applicable */}
              {notification.group_count && notification.group_count > 1 && (
                <p className="text-xs text-primary font-medium">
                  +{notification.group_count - 1} más similares
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-1">
                <Clock className="w-3 h-3" />
                <span>{format(notification.timestamp, 'dd/MM/yyyy HH:mm', { locale: es })}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  title="Marcar como leída"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
              )}
              
              {notification.actionUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary hover:text-primary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(notification);
                  }}
                  title="Ir a la sección"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notification.id);
                }}
                title="Descartar"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
