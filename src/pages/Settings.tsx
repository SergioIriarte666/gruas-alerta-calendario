
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
import { Building2, User, Settings as SettingsIcon, Bell, Users, Globe, CreditCard, Tag } from 'lucide-react';
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
    <div className="space-y-4 animate-fade-in bg-background min-h-screen settings-scope overflow-x-hidden">
      <SettingsHeader onReset={resetSettings} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-7 bg-card border h-auto p-1 gap-1">
            <TabsTrigger value="company" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <Building2 className="w-4 h-4" />
              <span>Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="timezone" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <Globe className="w-4 h-4" />
              <span>Zona Horaria</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <SettingsIcon className="w-4 h-4" />
              <span>Sistema</span>
            </TabsTrigger>
            <TabsTrigger value="payment-terms" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <CreditCard className="w-4 h-4" />
              <span>Cond. Pago</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <Bell className="w-4 h-4" />
              <span>Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <Users className="w-4 h-4" />
              <span>Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 text-foreground data-[state=active]:text-primary-foreground data-[state=active]:bg-primary hover:bg-muted p-2 h-auto min-h-[52px] text-xs whitespace-nowrap">
              <Tag className="w-4 h-4" />
              <span>Categorías</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
      </Tabs>
    </div>
  );
};

export default Settings;
