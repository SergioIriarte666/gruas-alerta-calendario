
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
  // Debug logging moved to component logic
  console.log('SystemSettingsTab rendering with settings:', settings);
  console.log('SystemSettingsTab - BackupManagementSection should render after main card');

  return (
    <div className="space-y-6" style={{ background: '#000000', minHeight: '100vh' }}>
      {/* Configuración del Sistema */}
      <Card 
        className="glass-card settings-card"
        style={{
          backgroundColor: '#000000',
          border: '1px solid #9cfa24',
          borderRadius: '8px',
          backdropFilter: 'blur(8px)'
        }}
      >
        <CardHeader style={{ backgroundColor: '#000000', borderBottom: '1px solid rgba(156, 250, 36, 0.3)' }}>
          <CardTitle className="flex items-center space-x-2" style={{ color: '#ffffff' }}>
            <Database className="w-5 h-5" style={{ color: '#9cfa24' }} />
            <span>Configuración del Sistema</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6" style={{ backgroundColor: '#000000', padding: '24px' }}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label style={{ color: '#ffffff' }}>Respaldo Automático</Label>
                <p className="text-sm" style={{ color: '#999999' }}>Crear respaldos automáticos de los datos</p>
              </div>
              <Switch 
                checked={settings.autoBackup}
                onCheckedChange={(checked) => onUpdateSettings({ autoBackup: checked })}
              />
            </div>
            
            <Separator style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />
            
            <div className="space-y-2">
              <Label style={{ color: '#ffffff' }}>Frecuencia de Respaldo</Label>
              <Select 
                value={settings.backupFrequency} 
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                  onUpdateSettings({ backupFrequency: value })
                }
                disabled={!settings.autoBackup}
              >
                <SelectTrigger 
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(156, 250, 36, 0.3)',
                    color: '#ffffff'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />

            <div className="space-y-2">
              <Label style={{ color: '#ffffff' }}>Retención de Datos (meses)</Label>
              <p className="text-sm" style={{ color: '#999999' }}>
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
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(156, 250, 36, 0.3)',
                  color: '#ffffff'
                }}
              />
            </div>

            <Separator style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center space-x-2" style={{ color: '#ffffff' }}>
                  <span>Modo Mantenimiento</span>
                  {settings.maintenanceMode && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </Label>
                <p className="text-sm" style={{ color: '#999999' }}>
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
            style={{
              backgroundColor: '#9cfa24',
              color: '#000000',
              fontWeight: '500'
            }}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </CardContent>
      </Card>

      {/* SECCIÓN DE GESTIÓN DE RESPALDOS - Forzada a renderizar */}
      <div 
        className="backup-section-container"
        style={{ 
          backgroundColor: '#000000', 
          padding: '8px',
          display: 'block',
          visibility: 'visible',
          opacity: 1
        }}
        data-component="backup-management"
      >
        <BackupManagementSection />
      </div>
    </div>
  );
};
