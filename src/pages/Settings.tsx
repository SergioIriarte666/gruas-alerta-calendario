import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { CompanySettingsTab } from '@/components/settings/CompanySettingsTab';
import { UserSettingsTab } from '@/components/settings/UserSettingsTab';
import { SystemSettingsTab } from '@/components/settings/SystemSettingsTab';
import { NotificationSettingsTab } from '@/components/settings/NotificationSettingsTab';
import {
  Building2,
  User,
  Settings as SettingsIcon,
  Bell,
} from 'lucide-react';

const Settings = () => {
  const { settings, loading, saving, updateSettings, updateLogo, resetSettings } = useSettings();
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

  const handleLogoChange = async (logoFile: File | null) => {
    const result = await updateLogo(logoFile);
    if (result.success) {
      toast({
        title: "Logotipo actualizado",
        description: "El cambio en el logotipo se ha guardado.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Error al guardar el logotipo",
        variant: "destructive",
      });
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SettingsHeader onReset={resetSettings} />

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

        <TabsContent value="company">
          <CompanySettingsTab
            settings={settings.company}
            saving={saving}
            onSave={(data) => handleSave('company', data)}
            onLogoChange={handleLogoChange}
            onUpdateSettings={(updates) => {
              if (settings) {
                updateSettings({ ...settings, ...updates });
              }
            }}
          />
        </TabsContent>

        <TabsContent value="user">
          <UserSettingsTab
            settings={settings.user}
            saving={saving}
            onSave={(data) => handleSave('user', data)}
            onUpdateSettings={(updates) => {
               if (settings) {
                updateSettings({ ...settings, ...updates });
              }
            }}
          />
        </TabsContent>

        <TabsContent value="system">
          <SystemSettingsTab
            settings={settings.system}
            saving={saving}
            onSave={(data) => handleSave('system', data)}
            onUpdateSettings={(updates) => {
               if (settings) {
                updateSettings({ ...settings, ...updates });
              }
            }}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsTab
            settings={settings.notifications}
            saving={saving}
            onSave={(data) => handleSave('notifications', data)}
            onUpdateSettings={(updates) => {
               if (settings) {
                updateSettings({ ...settings, ...updates });
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
