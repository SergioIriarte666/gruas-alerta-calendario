
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Database, Save, AlertTriangle, Timer, Shield } from 'lucide-react';
import type { SystemSettings } from '@/types/settings';
import { BackupManagementSection } from './BackupManagementSection';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6 bg-white min-h-screen">
      {/* Configuración del Sistema */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="bg-white border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2 text-black">
            <Database className="w-5 h-5 text-tms-green" />
            <span>Configuración del Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 bg-white p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-black">Respaldo Automático</Label>
                <p className="text-sm text-gray-600">Crear respaldos automáticos de los datos</p>
              </div>
              <Switch 
                checked={settings.autoBackup}
                onCheckedChange={(checked) => onUpdateSettings({ autoBackup: checked })}
              />
            </div>
            
            <Separator className="bg-gray-200" />
            
            <div className="space-y-2">
              <Label className="text-black">Frecuencia de Respaldo</Label>
              <Select 
                value={settings.backupFrequency} 
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                  onUpdateSettings({ backupFrequency: value })
                }
                disabled={!settings.autoBackup}
              >
                <SelectTrigger className="bg-white border-gray-300 text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-gray-200" />

            <div className="space-y-2">
              <Label className="text-black">Retención de Datos (meses)</Label>
              <p className="text-sm text-gray-600">
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
                className="bg-white border-gray-300 text-black"
              />
            </div>

            <Separator className="bg-gray-200" />
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center space-x-2 text-black">
                  <span>Modo Mantenimiento</span>
                  {settings.maintenanceMode && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </Label>
                <p className="text-sm text-gray-600">
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
            className="bg-tms-green text-black font-medium hover:bg-tms-green/80"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </CardContent>
      </Card>

      {/* Configuración de Sesión */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="bg-white border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2 text-black">
            <Timer className="w-5 h-5 text-tms-green" />
            <span>Tiempo de Sesión</span>
            {settings.sessionTimeoutEnabled && (
              <Badge className="ml-auto bg-tms-green/20 text-tms-green border border-tms-green/50">
                <Shield className="w-3 h-3 mr-1" />
                Activo
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white p-6 space-y-6">
          {/* Toggle principal */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-black">Cerrar sesión por inactividad</Label>
              <p className="text-sm text-gray-600">
                Protege tu cuenta cerrando sesión automáticamente
              </p>
            </div>
            <Switch 
              checked={settings.sessionTimeoutEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ sessionTimeoutEnabled: checked })}
            />
          </div>

          <Separator className="bg-gray-200" />

          {/* Configuración de tiempos */}
          <div className={cn(
            "space-y-6 transition-opacity duration-300",
            !settings.sessionTimeoutEnabled && "opacity-50 pointer-events-none"
          )}>
            {/* Tiempo de advertencia */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-black text-sm">
                  Mostrar advertencia después de:
                </Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded border border-gray-300 bg-gray-50 text-black font-medium text-lg tabular-nums">
                    {settings.sessionWarningMinutes}
                  </span>
                  <span className="text-gray-600 text-sm">min</span>
                </div>
              </div>
              <Slider
                value={[settings.sessionWarningMinutes]}
                onValueChange={(value) => {
                  const newWarning = value[0];
                  if (newWarning >= settings.sessionTimeoutMinutes) {
                    onUpdateSettings({ 
                      sessionWarningMinutes: newWarning,
                      sessionTimeoutMinutes: Math.min(newWarning + 5, 120)
                    });
                  } else {
                    onUpdateSettings({ sessionWarningMinutes: newWarning });
                  }
                }}
                min={5}
                max={55}
                step={5}
                disabled={!settings.sessionTimeoutEnabled}
                className="[&_[role=slider]]:bg-tms-green [&_[role=slider]]:border-tms-green"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>5 min</span>
                <span>30 min</span>
                <span>55 min</span>
              </div>
            </div>

            <Separator className="bg-gray-200" />

            {/* Tiempo de cierre */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-black text-sm">
                  Cerrar sesión automáticamente después de:
                </Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded border border-gray-300 bg-gray-50 text-black font-medium text-lg tabular-nums">
                    {settings.sessionTimeoutMinutes}
                  </span>
                  <span className="text-gray-600 text-sm">min</span>
                </div>
              </div>
              <Slider
                value={[settings.sessionTimeoutMinutes]}
                onValueChange={(value) => {
                  const newTimeout = value[0];
                  if (newTimeout <= settings.sessionWarningMinutes) {
                    onUpdateSettings({ 
                      sessionTimeoutMinutes: newTimeout,
                      sessionWarningMinutes: Math.max(newTimeout - 5, 5)
                    });
                  } else {
                    onUpdateSettings({ sessionTimeoutMinutes: newTimeout });
                  }
                }}
                min={10}
                max={120}
                step={5}
                disabled={!settings.sessionTimeoutEnabled}
                className="[&_[role=slider]]:bg-amber-500 [&_[role=slider]]:border-amber-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>10 min</span>
                <span>60 min</span>
                <span>120 min</span>
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-tms-green mt-0.5" />
                <p className="text-sm text-gray-600">
                  La sesión se cerrará automáticamente después de{' '}
                  <span className="font-medium text-black">{settings.sessionTimeoutMinutes} minutos</span>{' '}
                  de inactividad. Recibirás una advertencia{' '}
                  <span className="font-medium text-black">{settings.sessionTimeoutMinutes - settings.sessionWarningMinutes} minutos</span>{' '}
                  antes del cierre.
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={onSave}
            disabled={saving}
            className="bg-tms-green text-black font-medium hover:bg-tms-green/80"
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
