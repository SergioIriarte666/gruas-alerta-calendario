import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { useLogoUpdater } from '@/hooks/useLogoUpdater';
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
  const { settings, loading, saving, updateSettings, saveSettings, resetSettings } = useSettings();
  const { isUpdating: isLogoUpdating, updateLogo } = useLogoUpdater();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('company');

  const handleSave = async () => {
    const result = await saveSettings();
    if (result.success) {
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han guardado correctamente.",
      });
      console.log('Dispatching settings-updated event after saving settings');
      window.dispatchEvent(new Event('settings-updated'));
    } else {
      toast({
        title: "Error al guardar",
        description: result.error || "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    }
  };

  const handleLogoChange = async (logoFile: File | null) => {
    if (!settings) return;
    
    // El hook 'useLogoUpdater' ahora es más robusto y se encarga de todo.
    const result = await updateLogo(logoFile, settings);

    if (result.success) {
      toast({
        title: "Logotipo actualizado",
        description: "El cambio en el logotipo se ha guardado correctamente.",
      });

      // La única fuente de verdad será el evento que fuerza la recarga de datos.
      // Se elimina la actualización optimista del estado local.
      console.log('Dispatching settings-updated event to force global refetch.');
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } else {
      toast({
        title: "Error al actualizar logotipo",
        description: result.error || "Ocurrió un error inesperado al procesar el logo.",
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

  const isSavingForCompany = saving || isLogoUpdating;

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
            saving={isSavingForCompany}
            onSave={handleSave}
            onLogoChange={handleLogoChange}
            onUpdateSettings={updateSettings}
          />
        </TabsContent>

        <TabsContent value="user">
          <UserSettingsTab
            settings={settings.user}
            saving={saving}
            onSave={handleSave}
            onUpdateSettings={updateSettings}
          />
        </TabsContent>

        <TabsContent value="system">
          <SystemSettingsTab
            settings={settings.system}
            saving={saving}
            onSave={handleSave}
            onUpdateSettings={updateSettings}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsTab
            settings={settings.notifications}
            saving={saving}
            onSave={handleSave}
            onUpdateSettings={updateSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
