
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
import { Building2, User, Settings as SettingsIcon, Bell, Users } from 'lucide-react';

const Settings = () => {
  const {
    settings,
    loading,
    resetSettings
  } = useSettings();
  const {
    systemSettings,
    notificationSettings,
    loading: systemLoading,
    saving: systemSaving,
    updateSystemSettings,
    updateNotificationSettings,
    saveSettings: saveSystemSettings
  } = useSystemSettings();
  const {
    isUpdating: isLogoUpdating,
    updateLogo
  } = useLogoUpdater();
  const [activeTab, setActiveTab] = React.useState('company');

  const handleSystemSave = async () => {
    const result = await saveSystemSettings();
    if (result.success) {
      toast.success("Configuración del sistema guardada", {
        description: "Los cambios se han guardado correctamente."
      });
    } else {
      toast.error("Error al guardar", {
        description: result.error || "No se pudo guardar la configuración del sistema."
      });
    }
  };

  const handleLogoChange = async (logoFile: File | null) => {
    if (!settings) return;
    const result = await updateLogo(logoFile, settings);
    if (result.success) {
      toast.success("Logotipo actualizado", {
        description: "El cambio en el logotipo se ha guardado correctamente."
      });
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } else {
      toast.error("Error al actualizar logotipo", {
        description: result.error || "Ocurrió un error inesperado al procesar el logo."
      });
    }
  };

  if (loading || systemLoading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-96 bg-white text-black">
        <div className="text-black">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in bg-white min-h-screen p-6">
      <SettingsHeader onReset={resetSettings} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-white border border-gray-200 h-auto p-1 gap-1">
          <TabsTrigger 
            value="company" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-black data-[state=active]:text-black data-[state=active]:bg-tms-green hover:bg-gray-50 p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Empresa</span>
          </TabsTrigger>
          <TabsTrigger 
            value="user" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-black data-[state=active]:text-black data-[state=active]:bg-tms-green hover:bg-gray-50 p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Usuario</span>
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-black data-[state=active]:text-black data-[state=active]:bg-tms-green hover:bg-gray-50 p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <SettingsIcon className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Sistema</span>
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-black data-[state=active]:text-black data-[state=active]:bg-tms-green hover:bg-gray-50 p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Notificaciones</span>
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-black data-[state=active]:text-black data-[state=active]:bg-tms-green hover:bg-gray-50 p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm col-span-2 md:col-span-1"
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Usuarios</span>
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
          <NotificationSettingsTab />
        </TabsContent>

        <TabsContent value="users">
          <UserManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
