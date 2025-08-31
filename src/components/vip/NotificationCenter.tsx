import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send,
  Settings,
  Filter,
  Archive,
  Trash2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'email' | 'push' | 'system' | 'sms';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  serviceId?: string;
  serviceFolio?: string;
  clientId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  createdAt: string;
  sentAt?: string;
  readAt?: string;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  clientId: string;
  clientName: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  clientId,
  clientName
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'email',
      priority: 'high',
      title: 'Orden de Compra Requerida',
      message: 'El servicio SRV-4482 requiere orden de compra para continuar.',
      serviceId: 'srv-1',
      serviceFolio: 'SRV-4482',
      clientId,
      status: 'sent',
      createdAt: '2025-08-31T18:30:00Z',
      sentAt: '2025-08-31T18:32:00Z'
    },
    {
      id: '2',
      type: 'push',
      priority: 'medium',
      title: 'Servicio Completado',
      message: 'El servicio SRV-4481 ha sido completado exitosamente.',
      serviceId: 'srv-2',
      serviceFolio: 'SRV-4481',
      clientId,
      status: 'delivered',
      createdAt: '2025-08-31T16:15:00Z',
      sentAt: '2025-08-31T16:16:00Z'
    },
    {
      id: '3',
      type: 'system',
      priority: 'urgent',
      title: 'Escalamiento OC Pendiente',
      message: 'La orden de compra para SRV-4480 lleva 3 días pendiente.',
      serviceId: 'srv-3',
      serviceFolio: 'SRV-4480',
      clientId,
      status: 'pending',
      createdAt: '2025-08-31T20:00:00Z'
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    return notification.status === filter;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'push': return <Bell className="w-4 h-4" />;
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medium': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send className="w-3 h-3 text-green-400" />;
      case 'delivered': return <CheckCircle2 className="w-3 h-3 text-green-400" />;
      case 'failed': return <AlertTriangle className="w-3 h-3 text-red-400" />;
      case 'pending': return <Clock className="w-3 h-3 text-amber-400" />;
      case 'read': return <CheckCircle2 className="w-3 h-3 text-blue-400" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'pending': 'Pendiente',
      'sent': 'Enviado',
      'delivered': 'Entregado',
      'failed': 'Fallido',
      'read': 'Leído'
    };
    return labels[status] || status;
  };

  const resendNotification = (notificationId: string) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === notificationId 
        ? { 
            ...notif, 
            status: 'sent', 
            sentAt: new Date().toISOString() 
          }
        : notif
    ));
    toast.success('Notificación reenviada');
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    toast.success('Notificación eliminada');
  };

  // Stats
  const stats = {
    total: notifications.length,
    pending: notifications.filter(n => n.status === 'pending').length,
    sent: notifications.filter(n => n.status === 'sent').length,
    failed: notifications.filter(n => n.status === 'failed').length,
    delivered: notifications.filter(n => n.status === 'delivered').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            Centro de Notificaciones
          </h3>
          <p className="text-sm text-gray-400">
            Gestiona todas las comunicaciones con {clientName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-4 h-4 mr-2" />
            Nueva Notificación
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-white">{stats.total}</p>
            <p className="text-xs text-blue-400">Total</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-amber-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-white">{stats.pending}</p>
            <p className="text-xs text-amber-400">Pendientes</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-green-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-white">{stats.sent}</p>
            <p className="text-xs text-green-400">Enviados</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-white">{stats.delivered}</p>
            <p className="text-xs text-purple-400">Entregados</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-red-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-white">{stats.failed}</p>
            <p className="text-xs text-red-400">Fallidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {['all', 'pending', 'sent', 'failed'].map((filterOption) => (
          <Button
            key={filterOption}
            variant={filter === filterOption ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(filterOption as any)}
          >
            {filterOption === 'all' ? 'Todas' : 
             filterOption === 'pending' ? 'Pendientes' :
             filterOption === 'sent' ? 'Enviadas' : 'Fallidas'}
          </Button>
        ))}
      </div>

      {/* Notifications List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm text-white">
            Notificaciones Recientes ({filteredNotifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No hay notificaciones</h3>
                  <p className="text-gray-400">
                    {filter === 'all' ? 'No se han enviado notificaciones aún' : `No hay notificaciones ${filter}`}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 p-4 hover:bg-gray-800/30 transition-colors border-b border-gray-800/50 last:border-b-0"
                  >
                    {/* Type Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="p-2 bg-gray-700/50 rounded-lg">
                        {getTypeIcon(notification.type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white truncate">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-300 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className={getPriorityColor(notification.priority)}>
                            {notification.priority.toUpperCase()}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(notification.status)}
                            <span className="text-xs text-gray-400">
                              {getStatusLabel(notification.status)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-4">
                          {notification.serviceFolio && (
                            <span>Servicio: {notification.serviceFolio}</span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(notification.createdAt), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                          {notification.sentAt && (
                            <span>
                              Enviado: {format(new Date(notification.sentAt), 'HH:mm')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {notification.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendNotification(notification.id)}
                              className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300"
                            >
                              Reenviar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};