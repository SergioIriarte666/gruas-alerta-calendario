import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Bell,
  Package,
  Clock,
  TrendingDown,
  Shield,
  Info
} from 'lucide-react';
import { 
  useInventoryAlerts, 
  useDeleteAlert, 
  useToggleAlert 
} from '@/hooks/useInventoryAlerts';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { QuickLogin } from '@/components/auth/QuickLogin';
import { AlertConfigurationForm } from './AlertConfigurationForm';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlertConfigurationPanelProps {
  showNewForm: boolean;
  onShowNewForm: () => void;
  onCloseNewForm: () => void;
}

export const AlertConfigurationPanel: React.FC<AlertConfigurationPanelProps> = ({
  showNewForm,
  onShowNewForm,
  onCloseNewForm
}) => {
  const [editingAlert, setEditingAlert] = useState<string | null>(null);
  const { data: alerts = [], isLoading } = useInventoryAlerts();
  const deleteAlert = useDeleteAlert();
  const toggleAlert = useToggleAlert();
  const { 
    user, 
    isLoading: permissionsLoading, 
    isAuthenticated, 
    canCreateAlerts, 
    canModifyAlerts 
  } = useUserPermissions();

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <Package className="w-4 h-4" />;
      case 'expiring_soon':
        return <Clock className="w-4 h-4" />;
      case 'overstock':
        return <TrendingDown className="w-4 h-4" />;
      case 'no_movement':
        return <Bell className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'low_stock':
        return 'Stock Bajo';
      case 'expiring_soon':
        return 'Próximo a Vencer';
      case 'overstock':
        return 'Sobrestock';
      case 'no_movement':
        return 'Sin Movimiento';
      default:
        return type;
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta configuración de alerta?')) {
      await deleteAlert.mutateAsync(id);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleAlert.mutateAsync({ id, isActive: !isActive });
  };

  if (isLoading || permissionsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  // Show authentication warning if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Debes iniciar sesión para gestionar las configuraciones de alertas.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        
        <QuickLogin onLoginSuccess={() => window.location.reload()} />
      </div>
    );
  }

  // Show permission warning if user can't create alerts
  if (!canCreateAlerts && !canModifyAlerts) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>
                No tienes permisos para gestionar configuraciones de alertas. 
                Se requiere rol de <strong>Administrador</strong> u <strong>Operador</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Tu rol actual: <Badge variant="outline">{user?.role}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                Contacta al administrador del sistema para solicitar los permisos necesarios.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulario Nueva/Editar Alerta */}
      {(showNewForm || editingAlert) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {editingAlert ? 'Editar Configuración de Alerta' : 'Nueva Configuración de Alerta'}
            </CardTitle>
            <CardDescription>
              {editingAlert ? 'Modifica los parámetros de la alerta existente' : 'Define los parámetros para una nueva alerta automática'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertConfigurationForm
              alertId={editingAlert}
              onSuccess={() => {
                console.log('Alert form success callback triggered');
                setEditingAlert(null);
                onCloseNewForm();
              }}
              onCancel={() => {
                console.log('Alert form cancel callback triggered');
                setEditingAlert(null);
                onCloseNewForm();
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Lista de Configuraciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuraciones de Alertas
          </CardTitle>
          <CardDescription>
            Gestiona las reglas y parámetros de las alertas automáticas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay configuraciones de alerta
              </h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera configuración de alerta para comenzar el monitoreo automático
              </p>
              <Button 
                onClick={() => {
                  console.log('Create first alert button clicked');
                  onShowNewForm();
                }}
                className="flex items-center gap-2"
                disabled={!canCreateAlerts}
              >
                <Plus className="w-4 h-4" />
                Crear Primera Alerta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`border rounded-lg p-4 ${
                    alert.is_active ? 'border-border' : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getAlertTypeIcon(alert.alert_type)}
                          {getAlertTypeLabel(alert.alert_type)}
                        </Badge>
                        
                        <Badge variant={alert.is_active ? 'default' : 'secondary'}>
                          {alert.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{alert.item?.name || 'Todos los productos'}</span>
                          {alert.item?.sku && (
                            <span className="text-sm text-muted-foreground">({alert.item.sku})</span>
                          )}
                        </div>
                        
                        {alert.location && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Ubicación:</span>
                            <span className="text-sm">{alert.location.name}</span>
                          </div>
                        )}
                        
                        {alert.threshold_value && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Umbral:</span>
                            <span className="text-sm font-medium">{alert.threshold_value}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Creada {formatDistanceToNow(new Date(alert.created_at), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                        </div>
                        
                        {alert.last_triggered && (
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Última activación: {formatDistanceToNow(new Date(alert.last_triggered), { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={() => handleToggle(alert.id, alert.is_active)}
                        disabled={toggleAlert.isPending}
                      />
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAlert(alert.id)}
                        className="flex items-center gap-1"
                        disabled={!canModifyAlerts}
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(alert.id)}
                        disabled={deleteAlert.isPending || !canModifyAlerts}
                        className="flex items-center gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};