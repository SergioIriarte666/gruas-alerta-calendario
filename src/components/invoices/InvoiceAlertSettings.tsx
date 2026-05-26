import React from 'react';
import { Badge } from '@/components/ui/badge';
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
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
            <Bell className="size-3.5" />
            Facturación preventiva
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Seguimiento de vencimientos
          </Badge>
        </div>
        <CardTitle className="flex items-center gap-2 text-foreground text-lg sm:text-xl">
          <Bell className="size-5 text-primary" />
          Alertas de Facturas
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configura notificaciones sobre facturas vencidas y documentos próximos a vencer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
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

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
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
            <div className="ml-6 rounded-xl border border-border/70 bg-background/40 p-4 space-y-2">
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
                className="w-24 border-border/70 bg-background/60"
              />
              <p className="text-xs text-muted-foreground">
                Alertar {localSettings.due_soon_days} días antes del vencimiento
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Tipos de Notificaciones</h4>
          
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-primary" />
              <div>
                <Label>Notificaciones Push</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entrega avisos inmediatos en el navegador o dispositivo activo.
                </p>
              </div>
            </div>
            <Switch
              checked={localSettings.push_notifications}
              onCheckedChange={(checked) =>
                setLocalSettings(prev => ({ ...prev, push_notifications: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <div>
                <Label>Notificaciones por Email</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Envía alertas de vencimiento y seguimiento por correo electrónico.
                </p>
              </div>
            </div>
            <Switch
              checked={localSettings.email_notifications}
              onCheckedChange={(checked) =>
                setLocalSettings(prev => ({ ...prev, email_notifications: checked }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 border-t border-border/70 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isUpdating}
            className="flex-1"
          >
            Guardar
          </Button>
          <Button 
            variant="outline" 
            onClick={handleForceUpdate}
            disabled={isUpdating}
            className="flex items-center justify-center gap-2 border-border/70 bg-background/60"
          >
            <RefreshCw className={`size-4 ${isUpdating ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
