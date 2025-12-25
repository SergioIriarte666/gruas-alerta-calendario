
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

      {/* Configuración de Sesión - Estilo Retro Gaming */}
      <Card className="bg-white border-gray-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-cyan-500/30">
          <CardTitle className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-lg border-2",
              settings.sessionTimeoutEnabled 
                ? "border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_10px_rgba(0,255,255,0.3)]"
                : "border-gray-600 bg-gray-800/50"
            )}>
              <Timer className={cn(
                "w-5 h-5",
                settings.sessionTimeoutEnabled ? "text-cyan-400" : "text-gray-500"
              )} />
            </div>
            <div>
              <span className="font-mono text-white tracking-wide">Tiempo de Sesión</span>
              <p className="text-xs font-normal text-gray-400 font-mono">
                Seguridad por inactividad
              </p>
            </div>
            {settings.sessionTimeoutEnabled && (
              <Badge className="ml-auto bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 font-mono text-xs">
                <Shield className="w-3 h-3 mr-1" />
                ACTIVO
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-gradient-to-b from-gray-900 to-gray-950 p-6 space-y-6">
          {/* Toggle principal */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-gray-800/50">
            <div>
              <Label className="text-white font-mono">Cerrar sesión por inactividad</Label>
              <p className="text-sm text-gray-400 font-mono">
                Protege tu cuenta cerrando sesión automáticamente
              </p>
            </div>
            <Switch 
              checked={settings.sessionTimeoutEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ sessionTimeoutEnabled: checked })}
              className="data-[state=checked]:bg-cyan-500"
            />
          </div>

          {/* Configuración de tiempos */}
          <div className={cn(
            "space-y-6 transition-opacity duration-300",
            !settings.sessionTimeoutEnabled && "opacity-50 pointer-events-none"
          )}>
            {/* Tiempo de advertencia */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 font-mono text-sm">
                  Mostrar advertencia después de:
                </Label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded border font-mono text-lg tabular-nums",
                    "bg-gray-800 border-cyan-500/50 text-cyan-400",
                    "shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                  )}>
                    {settings.sessionWarningMinutes}
                  </span>
                  <span className="text-gray-400 font-mono text-sm">min</span>
                </div>
              </div>
              <Slider
                value={[settings.sessionWarningMinutes]}
                onValueChange={(value) => {
                  const newWarning = value[0];
                  // Asegurar que el timeout siempre sea mayor que el warning
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
                className="[&_[role=slider]]:bg-cyan-400 [&_[role=slider]]:border-cyan-500 [&_[role=slider]]:shadow-[0_0_10px_rgba(0,255,255,0.5)]"
              />
              <div className="flex justify-between text-xs text-gray-500 font-mono">
                <span>5 min</span>
                <span>30 min</span>
                <span>55 min</span>
              </div>
            </div>

            <Separator className="bg-gray-700" />

            {/* Tiempo de cierre */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 font-mono text-sm">
                  Cerrar sesión automáticamente después de:
                </Label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded border font-mono text-lg tabular-nums",
                    "bg-gray-800 border-yellow-500/50 text-yellow-400",
                    "shadow-[0_0_10px_rgba(255,200,0,0.2)]"
                  )}>
                    {settings.sessionTimeoutMinutes}
                  </span>
                  <span className="text-gray-400 font-mono text-sm">min</span>
                </div>
              </div>
              <Slider
                value={[settings.sessionTimeoutMinutes]}
                onValueChange={(value) => {
                  const newTimeout = value[0];
                  // Asegurar que el warning siempre sea menor que el timeout
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
                className="[&_[role=slider]]:bg-yellow-400 [&_[role=slider]]:border-yellow-500 [&_[role=slider]]:shadow-[0_0_10px_rgba(255,200,0,0.5)]"
              />
              <div className="flex justify-between text-xs text-gray-500 font-mono">
                <span>10 min</span>
                <span>60 min</span>
                <span>120 min</span>
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/30">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-cyan-500/20">
                  <Shield className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-sm text-gray-400 font-mono">
                  <p>
                    La sesión se cerrará automáticamente después de{' '}
                    <span className="text-yellow-400">{settings.sessionTimeoutMinutes} minutos</span>{' '}
                    de inactividad. Recibirás una advertencia{' '}
                    <span className="text-cyan-400">{settings.sessionTimeoutMinutes - settings.sessionWarningMinutes} minutos</span>{' '}
                    antes del cierre.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botón guardar con estilo retro */}
          <Button 
            onClick={onSave}
            disabled={saving}
            className={cn(
              "w-full h-12 font-mono font-bold tracking-wide",
              "bg-gradient-to-b from-cyan-600 to-cyan-700",
              "border-2 border-cyan-400/50",
              "hover:from-cyan-500 hover:to-cyan-600",
              "shadow-[0_0_15px_rgba(0,255,255,0.3)]",
              "hover:shadow-[0_0_25px_rgba(0,255,255,0.5)]",
              "transition-all duration-200",
              "text-white"
            )}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
          </Button>
        </CardContent>
      </Card>

      {/* Gestión de Respaldos */}
      <BackupManagementSection />
    </div>
  );
};
