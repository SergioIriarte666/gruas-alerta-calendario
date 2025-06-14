
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import {
  Building2,
  User,
  Settings as SettingsIcon,
  Bell,
  Save,
  RotateCcw,
  Shield,
  Database,
  Palette
} from 'lucide-react';

const Settings = () => {
  const { settings, loading, saving, updateSettings, resetSettings } = useSettings();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('company');

  const handleSave = async (section: string, data: any) => {
    const result = await updateSettings({ [section]: data });
    if (result.success) {
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han guardado correctamente",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Error al guardar la configuración",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
          <p className="text-gray-400 mt-2">
            Gestiona la configuración de la empresa, usuarios y sistema
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={resetSettings}
            className="border-gray-700 text-gray-300"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restablecer
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-black/20">
          <TabsTrigger value="company" className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <span>Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="user" className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span>Usuario</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center space-x-2">
            <SettingsIcon className="w-4 h-4" />
            <span>Sistema</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>Notificaciones</span>
          </TabsTrigger>
        </TabsList>

        {/* Configuración de Empresa */}
        <TabsContent value="company">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Building2 className="w-5 h-5 text-tms-green" />
                <span>Información de la Empresa</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-gray-300">Nombre de la Empresa</Label>
                  <Input
                    id="company-name"
                    value={settings.company.name}
                    onChange={(e) => updateSettings({
                      company: { ...settings.company, name: e.target.value }
                    })}
                    className="bg-white/5 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email" className="text-gray-300">Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={settings.company.email}
                    onChange={(e) => updateSettings({
                      company: { ...settings.company, email: e.target.value }
                    })}
                    className="bg-white/5 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone" className="text-gray-300">Teléfono</Label>
                  <Input
                    id="company-phone"
                    value={settings.company.phone}
                    onChange={(e) => updateSettings({
                      company: { ...settings.company, phone: e.target.value }
                    })}
                    className="bg-white/5 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-taxid" className="text-gray-300">RUT</Label>
                  <Input
                    id="company-taxid"
                    value={settings.company.taxId}
                    onChange={(e) => updateSettings({
                      company: { ...settings.company, taxId: e.target.value }
                    })}
                    className="bg-white/5 border-gray-700 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-address" className="text-gray-300">Dirección</Label>
                <Input
                  id="company-address"
                  value={settings.company.address}
                  onChange={(e) => updateSettings({
                    company: { ...settings.company, address: e.target.value }
                  })}
                  className="bg-white/5 border-gray-700 text-white"
                />
              </div>
              <Button 
                onClick={() => handleSave('company', settings.company)}
                disabled={saving}
                className="bg-tms-green hover:bg-tms-green-dark text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Usuario */}
        <TabsContent value="user">
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
                    value={settings.user.theme} 
                    onValueChange={(value) => updateSettings({
                      user: { ...settings.user, theme: value as 'light' | 'dark' | 'system' }
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
                    value={settings.user.language} 
                    onValueChange={(value) => updateSettings({
                      user: { ...settings.user, language: value as 'es' | 'en' }
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
                    value={settings.user.dateFormat} 
                    onValueChange={(value) => updateSettings({
                      user: { ...settings.user, dateFormat: value as any }
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
                    value={settings.user.currency} 
                    onValueChange={(value) => updateSettings({
                      user: { ...settings.user, currency: value as 'CLP' | 'USD' | 'EUR' }
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
                onClick={() => handleSave('user', settings.user)}
                disabled={saving}
                className="bg-tms-green hover:bg-tms-green-dark text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Preferencias'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración del Sistema */}
        <TabsContent value="system">
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
                    checked={settings.system.autoBackup}
                    onCheckedChange={(checked) => updateSettings({
                      system: { ...settings.system, autoBackup: checked }
                    })}
                  />
                </div>
                <Separator className="bg-gray-700" />
                <div className="space-y-2">
                  <Label className="text-gray-300">Frecuencia de Respaldo</Label>
                  <Select 
                    value={settings.system.backupFrequency} 
                    onValueChange={(value) => updateSettings({
                      system: { ...settings.system, backupFrequency: value as any }
                    })}
                    disabled={!settings.system.autoBackup}
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
                    {settings.system.maintenanceMode && (
                      <Badge variant="destructive">Activo</Badge>
                    )}
                    <Switch 
                      checked={settings.system.maintenanceMode}
                      onCheckedChange={(checked) => updateSettings({
                        system: { ...settings.system, maintenanceMode: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => handleSave('system', settings.system)}
                disabled={saving}
                className="bg-tms-green hover:bg-tms-green-dark text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Notificaciones */}
        <TabsContent value="notifications">
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
                    checked={settings.notifications.emailNotifications}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { ...settings.notifications, emailNotifications: checked }
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
                    checked={settings.notifications.serviceReminders}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { ...settings.notifications, serviceReminders: checked }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Alertas de Facturas</Label>
                    <p className="text-sm text-gray-500">Notificaciones sobre facturas pendientes</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.invoiceAlerts}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { ...settings.notifications, invoiceAlerts: checked }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Facturas Vencidas</Label>
                    <p className="text-sm text-gray-500">Alertas sobre facturas vencidas</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.overdueNotifications}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { ...settings.notifications, overdueNotifications: checked }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Actualizaciones del Sistema</Label>
                    <p className="text-sm text-gray-500">Notificaciones sobre actualizaciones disponibles</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.systemUpdates}
                    onCheckedChange={(checked) => updateSettings({
                      notifications: { ...settings.notifications, systemUpdates: checked }
                    })}
                  />
                </div>
              </div>
              <Button 
                onClick={() => handleSave('notifications', settings.notifications)}
                disabled={saving}
                className="bg-tms-green hover:bg-tms-green-dark text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Notificaciones'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
