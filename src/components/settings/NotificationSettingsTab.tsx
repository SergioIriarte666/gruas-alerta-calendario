
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Save } from 'lucide-react';
import type { NotificationSettings } from '@/types/settings';

interface NotificationSettingsTabProps {
  settings: NotificationSettings;
  saving: boolean;
  onSave: () => void;
  onUpdateSettings: (updates: Partial<NotificationSettings>) => void;
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
              <p className="text-sm text-gray-500">Recibir notificaciones por correo electrónico</p>
            </div>
            <Switch 
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => onUpdateSettings({ emailNotifications: checked })}
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
              onCheckedChange={(checked) => onUpdateSettings({ serviceReminders: checked })}
            />
          </div>
          
          <Separator className="bg-gray-700" />
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Alertas de Facturas</Label>
              <p className="text-sm text-gray-500">Notificaciones sobre facturas nuevas</p>
            </div>
            <Switch 
              checked={settings.invoiceAlerts}
              onCheckedChange={(checked) => onUpdateSettings({ invoiceAlerts: checked })}
            />
          </div>
          
          <Separator className="bg-gray-700" />
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Notificaciones de Vencimientos</Label>
              <p className="text-sm text-gray-500">Alertas sobre facturas vencidas</p>
            </div>
            <Switch 
              checked={settings.overdueNotifications}
              onCheckedChange={(checked) => onUpdateSettings({ overdueNotifications: checked })}
            />
          </div>
          
          <Separator className="bg-gray-700" />
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Actualizaciones del Sistema</Label>
              <p className="text-sm text-gray-500">Notificaciones sobre actualizaciones disponibles</p>
            </div>
            <Switch 
              checked={settings.systemUpdates}
              onCheckedChange={(checked) => onUpdateSettings({ systemUpdates: checked })}
            />
          </div>
        </div>
        
        <Button 
          onClick={onSave}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green-dark text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardContent>
    </Card>
  );
};
