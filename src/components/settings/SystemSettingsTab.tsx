
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Database, Save } from 'lucide-react';

interface SystemSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetention: number;
  maintenanceMode: boolean;
}

interface SystemSettingsTabProps {
  settings: SystemSettings;
  saving: boolean;
  onSave: (data: SystemSettings) => void;
  onUpdateSettings: (updates: { system: SystemSettings }) => void;
}

export const SystemSettingsTab: React.FC<SystemSettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onUpdateSettings
}) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Database className="w-5 h-5 text-tms-green" />
          <span>Configuración del Sistema</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Respaldo Automático</Label>
              <p className="text-sm text-gray-500">Crear respaldos automáticos de los datos</p>
            </div>
            <Switch 
              checked={settings.autoBackup}
              onCheckedChange={(checked) => onUpdateSettings({
                system: { ...settings, autoBackup: checked }
              })}
            />
          </div>
          <Separator className="bg-gray-700" />
          <div className="space-y-2">
            <Label className="text-gray-300">Frecuencia de Respaldo</Label>
            <Select 
              value={settings.backupFrequency} 
              onValueChange={(value) => onUpdateSettings({
                system: { ...settings, backupFrequency: value as any }
              })}
              disabled={!settings.autoBackup}
            >
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diario</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-300">Modo Mantenimiento</Label>
              <p className="text-sm text-gray-500">Activar para realizar mantenimiento del sistema</p>
            </div>
            <div className="flex items-center space-x-2">
              {settings.maintenanceMode && (
                <Badge variant="destructive">Activo</Badge>
              )}
              <Switch 
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => onUpdateSettings({
                  system: { ...settings, maintenanceMode: checked }
                })}
              />
            </div>
          </div>
        </div>
        <Button 
          onClick={() => onSave(settings)}
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
