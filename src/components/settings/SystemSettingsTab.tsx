
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Database, Save, AlertTriangle } from 'lucide-react';
import type { SystemSettings } from '@/types/settings';
import { BackupManagementSection } from './BackupManagementSection';

interface SystemSettingsTabProps {
  settings: SystemSettings;
  saving: boolean;
  onSave: () => void;
  onUpdateSettings: (updates: Partial<SystemSettings>) => void;
}

export const SystemSettingsTab: React.FC<SystemSettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onUpdateSettings
}) => {
  return (
    <div className="space-y-6">
      {/* Configuración del Sistema */}
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
                onCheckedChange={(checked) => onUpdateSettings({ autoBackup: checked })}
              />
            </div>
            
            <Separator className="bg-gray-700" />
            
            <div className="space-y-2">
              <Label className="text-gray-300">Frecuencia de Respaldo</Label>
              <Select 
                value={settings.backupFrequency} 
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                  onUpdateSettings({ backupFrequency: value })
                }
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

            <Separator className="bg-gray-700" />

            <div className="space-y-2">
              <Label className="text-gray-300">Retención de Datos (meses)</Label>
              <p className="text-sm text-gray-500">
                Tiempo que se mantendrán los datos en el sistema
              </p>
              <Input
                type="number"
                min="1"
                max="60"
                value={settings.dataRetention}
                onChange={(e) => onUpdateSettings({ 
                  dataRetention: parseInt(e.target.value) || 12 
                })}
                className="bg-white/5 border-gray-700 text-white"
              />
            </div>

            <Separator className="bg-gray-700" />
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-300 flex items-center space-x-2">
                  <span>Modo Mantenimiento</span>
                  {settings.maintenanceMode && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </Label>
                <p className="text-sm text-gray-500">
                  Activar para realizar mantenimiento del sistema
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {settings.maintenanceMode && (
                  <Badge variant="destructive">Activo</Badge>
                )}
                <Switch 
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => onUpdateSettings({ maintenanceMode: checked })}
                />
              </div>
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

      {/* Gestión de Respaldos */}
      <BackupManagementSection />
    </div>
  );
};
