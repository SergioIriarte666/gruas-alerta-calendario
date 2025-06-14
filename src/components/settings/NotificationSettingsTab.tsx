
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Save } from 'lucide-react';

interface NotificationSettings {
  emailNotifications: boolean;
  serviceReminders: boolean;
  invoiceAlerts: boolean;
  overdueNotifications: boolean;
  systemUpdates: boolean;
}

interface NotificationSettingsTabProps {
  settings: NotificationSettings;
  saving: boolean;
  onSave: (data: NotificationSettings) => void;
  onUpdateSettings: (updates: { notifications: NotificationSettings }) => void;
}

export const NotificationSettingsTab: React.FC<NotificationSettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onUpdateSettings
}) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Bell className="w-5 h-5 text-tms-green" />
          <span>Configuración de Notificaciones</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Notificaciones por Email</Label>
              <p className="text-sm text-gray-500">Recibir notificaciones generales por correo</p>
            </div>
            <Switch 
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => onUpdateSettings({
                notifications: { ...settings, emailNotifications: checked }
              })}
            />
          </div>
          <Separator className="bg-gray-700" />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Recordatorios de Servicios</Label>
              <p className="text-sm text-gray-500">Alertas sobre servicios programados</p>
            </div>
            <Switch 
              checked={settings.serviceReminders}
              onCheckedChange={(checked) => onUpdateSettings({
                notifications: { ...settings, serviceReminders: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Alertas de Facturas</Label>
              <p className="text-sm text-gray-500">Notificaciones sobre facturas pendientes</p>
            </div>
            <Switch 
              checked={settings.invoiceAlerts}
              onCheckedChange={(checked) => onUpdateSettings({
                notifications: { ...settings, invoiceAlerts: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Facturas Vencidas</Label>
              <p className="text-sm text-gray-500">Alertas sobre facturas vencidas</p>
            </div>
            <Switch 
              checked={settings.overdueNotifications}
              onCheckedChange={(checked) => onUpdateSettings({
                notifications: { ...settings, overdueNotifications: checked }
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Actualizaciones del Sistema</Label>
              <p className="text-sm text-gray-500">Notificaciones sobre actualizaciones disponibles</p>
            </div>
            <Switch 
              checked={settings.systemUpdates}
              onCheckedChange={(checked) => onUpdateSettings({
                notifications: { ...settings, systemUpdates: checked }
              })}
            />
          </div>
        </div>
        <Button 
          onClick={() => onSave(settings)}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green-dark text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Notificaciones'}
        </Button>
      </CardContent>
    </Card>
  );
};
