
import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useLogoUpdater } from '@/hooks/useLogoUpdater';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { CompanySettingsTab } from '@/components/settings/CompanySettingsTab';
import { UserSettingsTab } from '@/components/settings/UserSettingsTab';
import { SystemSettingsTab } from '@/components/settings/SystemSettingsTab';
import { NotificationSettingsTab } from '@/components/settings/NotificationSettingsTab';
import { UserManagementTab } from '@/components/settings/UserManagementTab';
import {
  Building2,
  User,
  Settings as SettingsIcon,
  Bell,
  Users,
} from 'lucide-react';

const Settings = () => {
  const { settings, loading, resetSettings } = useSettings();
  const { 
    systemSettings, 
    notificationSettings, 
    loading: systemLoading, 
    saving: systemSaving,
    updateSystemSettings,
    updateNotificationSettings,
    saveSettings: saveSystemSettings
  } = useSystemSettings();
  const { isUpdating: isLogoUpdating, updateLogo } = useLogoUpdater();
  const [activeTab, setActiveTab] = React.useState('company');

  // Debug logging moved to component logic
  console.log('Settings page rendering - activeTab:', activeTab);
  console.log('Settings - systemSettings:', systemSettings);
  console.log('Settings - BackupManagementSection should be visible in System tab');

  const handleSystemSave = async () => {
    const result = await saveSystemSettings();
    if (result.success) {
      toast.success("Configuración del sistema guardada", {
        description: "Los cambios se han guardado correctamente.",
      });
    } else {
      toast.error("Error al guardar", {
        description: result.error || "No se pudo guardar la configuración del sistema.",
      });
    }
  };

  const handleLogoChange = async (logoFile: File | null) => {
    if (!settings) return;
    
    const result = await updateLogo(logoFile, settings);

    if (result.success) {
      toast.success("Logotipo actualizado", {
        description: "El cambio en el logotipo se ha guardado correctamente.",
      });

      console.log('Dispatching settings-updated event to force global refetch.');
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } else {
      toast.error("Error al actualizar logotipo", {
        description: result.error || "Ocurrió un error inesperado al procesar el logo.",
      });
    }
  };

  if (loading || systemLoading || !settings) {
    return (
      <div 
        className="flex items-center justify-center min-h-96 settings-container"
        style={{ backgroundColor: '#000000', color: '#ffffff' }}
      >
        <div style={{ color: '#ffffff' }}>Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div 
      className="space-y-6 animate-fade-in settings-container"
      style={{ backgroundColor: '#000000', minHeight: '100vh', padding: '24px' }}
    >
      <SettingsHeader onReset={resetSettings} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList 
          className="grid w-full grid-cols-5"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(156, 250, 36, 0.3)'
          }}
        >
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
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Usuarios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanySettingsTab />
        </TabsContent>

        <TabsContent value="user">
          <UserSettingsTab
            settings={settings.user}
            saving={false}
            onSave={async () => ({ success: true })}
            onUpdateSettings={() => {}}
          />
        </TabsContent>

        <TabsContent value="system">
          <SystemSettingsTab
            settings={systemSettings}
            saving={systemSaving}
            onSave={handleSystemSave}
            onUpdateSettings={updateSystemSettings}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsTab
            settings={notificationSettings}
            saving={systemSaving}
            onSave={handleSystemSave}
            onUpdateSettings={updateNotificationSettings}
          />
        </TabsContent>

        <TabsContent value="users">
          <UserManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
