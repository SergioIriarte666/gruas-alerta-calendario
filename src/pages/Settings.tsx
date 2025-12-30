
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
import { InvoiceAlertSettings } from '@/components/invoices/InvoiceAlertSettings';
import { UserManagementTab } from '@/components/settings/UserManagementTab';
import { PaymentTermsSettings } from '@/components/settings/PaymentTermsSettings';
import { OfflineSettingsPanel } from '@/components/settings/OfflineSettingsPanel';
import { Building2, User, Settings as SettingsIcon, Bell, Users, Globe, CreditCard, Tag, CloudOff } from 'lucide-react';
import { TimezoneSettingsTab } from '@/components/settings/TimezoneSettingsTab';
import { CategoriesTab } from '@/components/settings/CategoriesTab';

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
      <div className="flex items-center justify-center min-h-96 bg-background text-foreground">
        <div className="text-foreground">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in bg-background min-h-screen p-6 settings-scope">
      <SettingsHeader onReset={resetSettings} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 bg-card border h-auto p-1 gap-1">
          <TabsTrigger 
            value="company" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Empresa</span>
          </TabsTrigger>
          <TabsTrigger 
            value="timezone" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Zona Horaria</span>
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <SettingsIcon className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Sistema</span>
          </TabsTrigger>
          <TabsTrigger 
            value="payment-terms" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <CreditCard className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Condiciones Pago</span>
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Notificaciones</span>
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Usuarios</span>
          </TabsTrigger>
          <TabsTrigger 
            value="categories" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <Tag className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Categorías</span>
          </TabsTrigger>
          <TabsTrigger 
            value="offline" 
            className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 md:p-3 h-auto min-h-[60px] text-xs md:text-sm"
          >
            <CloudOff className="w-4 h-4 flex-shrink-0" />
            <span className="text-center">Offline</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanySettingsTab />
        </TabsContent>

        <TabsContent value="timezone">
          <TimezoneSettingsTab />
        </TabsContent>

        <TabsContent value="system">
          <SystemSettingsTab 
            settings={systemSettings} 
            saving={systemSaving} 
            onSave={handleSystemSave} 
            onUpdateSettings={updateSystemSettings} 
          />
        </TabsContent>

        <TabsContent value="payment-terms">
          <PaymentTermsSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-6">
            <NotificationSettingsTab />
            <InvoiceAlertSettings />
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UserManagementTab />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="offline">
          <OfflineSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
