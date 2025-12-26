import React, { useState, useMemo } from 'react';
import { Bell, Check, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { NotificationItem } from './NotificationItem';
import { NotificationFilters } from './NotificationFilters';
import { useNotificationsSync } from '@/hooks/useNotificationsSync';
import { useNotificationsData } from '@/hooks/useNotificationsData';
import { Notification, NotificationFilters as FiltersType, NotificationGroup, CATEGORY_CONFIG, NotificationCategory } from '@/types/notifications';
import { cn } from '@/lib/utils';

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FiltersType>({
    category: 'all',
    status: 'all',
    priority: 'all',
    search: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Get both synced DB notifications and generated notifications
  const { 
    notifications: dbNotifications, 
    loading: dbLoading,
    unreadCount,
    criticalCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    dismissAllNotifications,
    refetch,
  } = useNotificationsSync(filters);

  const { notifications: generatedNotifications, loading: generatedLoading } = useNotificationsData();

  // Merge notifications (prioritize DB notifications, add generated ones if not dismissed)
  const allNotifications = useMemo(() => {
    const dbIds = new Set(dbNotifications.map(n => n.id));
    const mergedNotifications: Notification[] = [
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

    return mergedNotifications.sort((a, b) => {
      // Sort by read status first (unread first)
      if (a.read !== b.read) return a.read ? 1 : -1;
      // Then by priority
      if ((a.priority || 4) !== (b.priority || 4)) return (a.priority || 4) - (b.priority || 4);
      // Then by timestamp
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [dbNotifications, generatedNotifications]);

  // Apply filters
  const filteredNotifications = useMemo(() => {
    return allNotifications.filter(n => {
      if (filters.category && filters.category !== 'all' && n.category !== filters.category) return false;
      if (filters.status === 'unread' && n.read) return false;
      if (filters.status === 'read' && !n.read) return false;
      if (filters.priority && filters.priority !== 'all' && n.priority !== filters.priority) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!n.title.toLowerCase().includes(searchLower) && 
            !n.message.toLowerCase().includes(searchLower)) return false;
      }
      return true;
    });
  }, [allNotifications, filters]);

  // Group notifications by category
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    filteredNotifications.forEach(n => {
      if (!groups[n.category]) groups[n.category] = [];
      groups[n.category].push(n);
    });
    return groups;
  }, [filteredNotifications]);

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
    }
  };

  const handleBulkMarkAsRead = () => {
    selectedIds.forEach(id => markAsRead(id));
    setSelectedIds(new Set());
  };

  const handleBulkDismiss = () => {
    selectedIds.forEach(id => dismissNotification(id));
    setSelectedIds(new Set());
  };

  const loading = dbLoading || generatedLoading;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{allNotifications.length}</p>
              </div>
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sin leer</p>
                <p className="text-2xl font-bold text-primary">{unreadCount}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold">{unreadCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={loading}
                className="flex-1"
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-2" />
                Leer todas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <NotificationFilters
            filters={filters}
            onFiltersChange={setFilters}
            totalCount={allNotifications.length}
            filteredCount={filteredNotifications.length}
          />
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-foreground">
              {selectedIds.size} notificaciones seleccionadas
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkMarkAsRead}>
                <Check className="w-4 h-4 mr-2" />
                Marcar como leídas
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDismiss}>
                <Trash2 className="w-4 h-4 mr-2" />
                Descartar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificaciones
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground">{unreadCount} nuevas</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                Todas ({filteredNotifications.length})
              </TabsTrigger>
              {(Object.keys(groupedByCategory) as NotificationCategory[]).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {CATEGORY_CONFIG[category]?.label || category} ({groupedByCategory[category]?.length || 0})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[500px] pr-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay notificaciones</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onDismiss={dismissNotification}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {(Object.keys(groupedByCategory) as NotificationCategory[]).map((category) => (
              <TabsContent key={category} value={category}>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {groupedByCategory[category]?.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onDismiss={dismissNotification}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
