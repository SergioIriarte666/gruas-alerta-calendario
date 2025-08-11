import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bell, Mail, Smartphone, RefreshCw } from 'lucide-react';
import { useInvoiceAlerts } from '@/hooks/useInvoiceAlerts';

export const InvoiceAlertSettings = () => {
  const { 
    alertSettings, 
    updateAlertSettings, 
    forceUpdateOverdueInvoices,
    isUpdating 
  } = useInvoiceAlerts();

  const [localSettings, setLocalSettings] = React.useState(alertSettings);

  React.useEffect(() => {
    setLocalSettings(alertSettings);
  }, [alertSettings]);

  const handleSave = () => {
    updateAlertSettings(localSettings);
  };

  const handleForceUpdate = () => {
    forceUpdateOverdueInvoices();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configuración de Alertas de Facturas
        </CardTitle>
        <CardDescription>
          Configura cómo y cuándo recibir notificaciones sobre facturas vencidas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alertas de Facturas Vencidas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Alertas de Facturas Vencidas</Label>
              <p className="text-sm text-muted-foreground">
                Recibir notificaciones cuando las facturas estén vencidas
              </p>
            </div>
            <Switch
              checked={localSettings.overdue_alerts_enabled}
              onCheckedChange={(checked) =>
                setLocalSettings(prev => ({ ...prev, overdue_alerts_enabled: checked }))
              }
            />
          </div>
        </div>

        {/* Alertas de Facturas Próximas a Vencer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Alertas de Vencimiento Próximo</Label>
              <p className="text-sm text-muted-foreground">
                Recibir notificaciones antes de que las facturas venzan
              </p>
            </div>
            <Switch
              checked={localSettings.due_soon_alerts_enabled}
              onCheckedChange={(checked) =>
                setLocalSettings(prev => ({ ...prev, due_soon_alerts_enabled: checked }))
              }
            />
          </div>

          {localSettings.due_soon_alerts_enabled && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="due-soon-days">Días de anticipación</Label>
              <Input
                id="due-soon-days"
                type="number"
                min="1"
                max="30"
                value={localSettings.due_soon_days}
                onChange={(e) =>
                  setLocalSettings(prev => ({ 
                    ...prev, 
                    due_soon_days: parseInt(e.target.value) || 7 
                  }))
                }
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Alertar {localSettings.due_soon_days} días antes del vencimiento
              </p>
            </div>
          )}
        </div>

        {/* Tipos de Notificaciones */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Tipos de Notificaciones</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <Label>Notificaciones Push</Label>
            </div>
            <Switch
              checked={localSettings.push_notifications}
              onCheckedChange={(checked) =>
                setLocalSettings(prev => ({ ...prev, push_notifications: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <Label>Notificaciones por Email</Label>
            </div>
            <Switch
              checked={localSettings.email_notifications}
              onCheckedChange={(checked) =>
                setLocalSettings(prev => ({ ...prev, email_notifications: checked }))
              }
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={isUpdating}
            className="flex-1"
          >
            Guardar Configuración
          </Button>
          <Button 
            variant="outline" 
            onClick={handleForceUpdate}
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            Actualizar Estados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};