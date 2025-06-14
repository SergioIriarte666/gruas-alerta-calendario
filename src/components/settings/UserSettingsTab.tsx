
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Save } from 'lucide-react';

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  currency: 'CLP' | 'USD' | 'EUR';
}

interface UserSettingsTabProps {
  settings: UserSettings;
  saving: boolean;
  onSave: (data: UserSettings) => void;
  onUpdateSettings: (updates: { user: UserSettings }) => void;
}

export const UserSettingsTab: React.FC<UserSettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onUpdateSettings
}) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Palette className="w-5 h-5 text-tms-green" />
          <span>Preferencias de Usuario</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-gray-300">Tema</Label>
            <Select 
              value={settings.theme} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, theme: value as 'light' | 'dark' | 'system' }
              })}
            >
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Oscuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Idioma</Label>
            <Select 
              value={settings.language} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, language: value as 'es' | 'en' }
              })}
            >
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Formato de Fecha</Label>
            <Select 
              value={settings.dateFormat} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, dateFormat: value as any }
              })}
            >
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Moneda</Label>
            <Select 
              value={settings.currency} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, currency: value as 'CLP' | 'USD' | 'EUR' }
              })}
            >
              <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLP">Peso Chileno (CLP)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button 
          onClick={() => onSave(settings)}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green-dark text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Preferencias'}
        </Button>
      </CardContent>
    </Card>
  );
};
