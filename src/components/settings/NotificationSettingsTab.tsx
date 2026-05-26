
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { PushNotificationManager } from '@/components/notifications/PushNotificationManager';
import { toast } from 'sonner';
import { Bell, Clock3, Loader2, Mail, ShieldAlert, Wrench } from 'lucide-react';

export const NotificationSettingsTab = () => {
  const {
    notificationSettings,
    saving,
    updateNotificationSettings,
    saveSettings
  } = useSystemSettings();

  const handleSave = async () => {
    const result = await saveSettings();
    if (result.success) {
      toast.success("Configuración de notificaciones guardada", {
        description: "Los cambios se han guardado correctamente."
      });
    } else {
      toast.error("Error al guardar", {
        description: result.error || "No se pudo guardar la configuración de notificaciones."
      });
    }
  };

  const handleToggle = (setting: keyof typeof notificationSettings, value: boolean) => {
    updateNotificationSettings({ [setting]: value });
  };

  const notificationOptions = [
    {
      id: 'emailNotifications',
      label: 'Notificaciones por Email',
      description: 'Recibir notificaciones importantes por correo electrónico.',
      icon: Mail,
    },
    {
      id: 'serviceReminders',
      label: 'Recordatorios de Servicios',
      description: 'Notificaciones sobre servicios próximos y vencimientos.',
      icon: Clock3,
    },
    {
      id: 'invoiceAlerts',
      label: 'Alertas de Facturas',
      description: 'Notificaciones sobre facturas vencidas y pagos pendientes.',
      icon: ShieldAlert,
    },
    {
      id: 'overdueNotifications',
      label: 'Notificaciones de Vencimientos',
      description: 'Alertas sobre documentos y servicios vencidos.',
      icon: Bell,
    },
    {
      id: 'systemUpdates',
      label: 'Actualizaciones del Sistema',
      description: 'Notificaciones sobre actualizaciones y mantenimiento del sistema.',
      icon: Wrench,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
              <Bell className="size-3.5" />
              Centro de notificaciones
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {notificationOptions.length} controles disponibles
            </Badge>
          </div>
          <CardTitle className="text-foreground text-lg sm:text-xl">Configuración de Notificaciones</CardTitle>
          <CardDescription>
            Define qué avisos deben llegar por correo, vencimientos y eventos importantes del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {notificationOptions.map((option) => {
            const Icon = option.icon;

            return (
              <div
                key={option.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={option.id} className="text-sm font-medium text-foreground">
                      {option.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={option.id}
                  checked={notificationSettings[option.id]}
                  onCheckedChange={(checked) => handleToggle(option.id, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <PushNotificationManager />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
