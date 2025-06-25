
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-black">Configuración de Notificaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications" className="text-black">Notificaciones por Email</Label>
              <p className="text-sm text-gray-600">
                Recibir notificaciones importantes por correo electrónico
              </p>
            </div>
            <Switch
              id="emailNotifications"
              checked={notificationSettings.emailNotifications}
              onCheckedChange={(checked) => handleToggle('emailNotifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="serviceReminders" className="text-black">Recordatorios de Servicios</Label>
              <p className="text-sm text-gray-600">
                Notificaciones sobre servicios próximos y vencimientos
              </p>
            </div>
            <Switch
              id="serviceReminders"
              checked={notificationSettings.serviceReminders}
              onCheckedChange={(checked) => handleToggle('serviceReminders', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="invoiceAlerts" className="text-black">Alertas de Facturas</Label>
              <p className="text-sm text-gray-600">
                Notificaciones sobre facturas vencidas y pagos pendientes
              </p>
            </div>
            <Switch
              id="invoiceAlerts"
              checked={notificationSettings.invoiceAlerts}
              onCheckedChange={(checked) => handleToggle('invoiceAlerts', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="overdueNotifications" className="text-black">Notificaciones de Vencimientos</Label>
              <p className="text-sm text-gray-600">
                Alertas sobre documentos y servicios vencidos
              </p>
            </div>
            <Switch
              id="overdueNotifications"
              checked={notificationSettings.overdueNotifications}
              onCheckedChange={(checked) => handleToggle('overdueNotifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="systemUpdates" className="text-black">Actualizaciones del Sistema</Label>
              <p className="text-sm text-gray-600">
                Notificaciones sobre actualizaciones y mantenimiento del sistema
              </p>
            </div>
            <Switch
              id="systemUpdates"
              checked={notificationSettings.systemUpdates}
              onCheckedChange={(checked) => handleToggle('systemUpdates', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green/90 text-white"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
