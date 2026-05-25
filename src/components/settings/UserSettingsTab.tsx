
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Palette, Save } from 'lucide-react';
import type { UserSettings } from '@/types/settings';
import { useTheme } from '@/contexts/ThemeContext';

interface UserSettingsTabProps {
  settings: UserSettings;
  saving: boolean;
  onSave: () => void;
  onUpdateSettings: (updates: Partial<{ user: UserSettings }>) => void;
}

export const UserSettingsTab: React.FC<UserSettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onUpdateSettings
}) => {
  const { theme, setTheme } = useTheme();
  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="flex items-center gap-x-2 text-foreground">
          <Palette className="size-5 text-primary" />
          <span className="text-foreground">Preferencias de Usuario</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-foreground">Tema</Label>
            <Select 
              value={theme}
              onValueChange={(value) => {
                const t = value as 'light' | 'dark' | 'system';
                setTheme(t);
                onUpdateSettings({ user: { ...settings, theme: t } });
              }}
            >
              <SelectTrigger className="bg-background border-input text-foreground">
                <SelectValue className="text-foreground" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Oscuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-foreground">Idioma</Label>
            <Select 
              value={settings.language} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, language: value as 'es' | 'en' }
              })}
            >
              <SelectTrigger className="bg-background border-input text-foreground">
                <SelectValue className="text-foreground" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-foreground">Formato de Fecha</Label>
            <Select 
              value={settings.dateFormat} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, dateFormat: value as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' }
              })}
            >
              <SelectTrigger className="bg-background border-input text-foreground">
                <SelectValue className="text-foreground" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-foreground">Moneda</Label>
            <Select 
              value={settings.currency} 
              onValueChange={(value) => onUpdateSettings({
                user: { ...settings, currency: value as 'CLP' | 'USD' | 'EUR' }
              })}
            >
              <SelectTrigger className="bg-background border-input text-foreground">
                <SelectValue className="text-foreground" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLP">Peso Chileno (CLP)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-foreground">Notificaciones</Label>
            <p className="text-sm text-muted-foreground">Recibir notificaciones en el sistema</p>
          </div>
          <Switch
            checked={settings.notifications}
            onCheckedChange={(checked) => onUpdateSettings({ 
              user: { ...settings, notifications: checked } 
            })}
          />
        </div>
        
        <Button 
          onClick={onSave}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green/80 text-black"
        >
          <Save className="size-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Preferencias'}
        </Button>
      </CardContent>
    </Card>
  );
};
