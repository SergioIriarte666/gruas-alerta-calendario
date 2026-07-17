
import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { CompanySettingsTab } from '@/components/settings/CompanySettingsTab';
import { SystemSettingsTab } from '@/components/settings/SystemSettingsTab';
import { NotificationSettingsTab } from '@/components/settings/NotificationSettingsTab';
import { InvoiceAlertSettings } from '@/components/invoices/InvoiceAlertSettings';
import { WhatsAppSettingsSection } from '@/components/settings/WhatsAppSettingsSection';
import { EmailNotificationSettingsSection } from '@/components/settings/EmailNotificationSettingsSection';
import { UserManagementTab } from '@/components/settings/UserManagementTab';
import { PaymentTermsSettings } from '@/components/settings/PaymentTermsSettings';
import { Building2, Settings as SettingsIcon, Bell, Users, Globe, CreditCard, Tag, Unlock, SlidersHorizontal, LayoutGrid, ClipboardList, ArchiveRestore } from 'lucide-react';
import { TimezoneSettingsTab } from '@/components/settings/TimezoneSettingsTab';
import { CategoriesTab } from '@/components/settings/CategoriesTab';
import { InspectionEquipmentTab } from '@/components/settings/InspectionEquipmentTab';
import { AdminEmergencyPanel } from '@/components/admin/AdminEmergencyPanel';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AuditTab } from '@/components/settings/AuditTab';
import { RecoveryCenterTab } from '@/components/settings/RecoveryCenterTab';

const Settings = () => {
  const {
    settings,
    loading,
    resetSettings
  } = useSettings();
  const {
    systemSettings,
    notificationSettings: _notificationSettings,
    loading: systemLoading,
    saving: systemSaving,
    updateSystemSettings,
    updateNotificationSettings: _updateNotificationSettings,
    saveSettings: saveSystemSettings
  } = useSystemSettings();
  const { isAdmin } = useUserPermissions();
  const [activeTab, setActiveTab] = React.useState('company');

  // Soporte para anchors: /settings#respaldos abre la pestaña Sistema
  // y hace scroll a la sección de Gestión de Respaldos.
  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;
      if (hash === 'respaldos') {
        setActiveTab('system');
        // Esperar a que la pestaña pinte
        setTimeout(() => {
          const el = document.getElementById('respaldos');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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

  const tabs = [
    { value: 'company', label: 'Empresa', icon: Building2 },
    { value: 'timezone', label: 'Zona horaria', icon: Globe },
    { value: 'system', label: 'Sistema', icon: SettingsIcon },
    { value: 'payment-terms', label: 'Cond. pago', icon: CreditCard },
    { value: 'notifications', label: 'Alertas', icon: Bell },
    { value: 'categories', label: 'Categorías', icon: Tag },
    { value: 'inspection-equipment', label: 'Inventario', icon: ClipboardList },
    ...(isAdmin ? [
      { value: 'users',      label: 'Usuarios',    icon: Users },
      { value: 'audit',      label: 'Auditoría',  icon: ClipboardList },
      { value: 'recovery',   label: 'Recuperación', icon: ArchiveRestore },
      { value: 'liberation', label: 'Liberación', icon: Unlock },
    ] : []),
  ];

  if (loading || systemLoading || !settings) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>

        <SectionCard flush className="border-border/70 bg-card/80 shadow-sm" contentClassName="space-y-4">
          <div className="flex flex-wrap gap-2 px-3 pt-4 sm:px-6 sm:pt-6">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
          <div className="px-3 sm:px-6">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="grid gap-4 px-3 pb-4 sm:px-6 sm:pb-6 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="settings-concept min-h-screen space-y-6 overflow-x-hidden pb-6 animate-fade-in">
      <SettingsHeader onReset={resetSettings} />

      <SectionCard flush className="configuration-panel border-border/70 bg-card/80 shadow-sm" contentClassName="space-y-4">
        <div className="flex flex-wrap gap-2 px-3 pt-4 sm:px-6 sm:pt-6">
          <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
            <SlidersHorizontal className="size-3.5" />
            Ajustes globales
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full px-3 py-1">
            <LayoutGrid className="size-3.5" />
            {tabs.length} secciones activas
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {isAdmin ? 'Modo administrador' : 'Perfil estándar'}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 px-3 pb-4 sm:px-6 sm:pb-6">
          <div className="overflow-x-auto scrollbar-none -mx-3 sm:-mx-6 px-3 sm:px-6">
            <TabsList className="configuration-tabs flex w-max min-w-full gap-1 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-muted-foreground whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="size-3.5 sm:size-4 shrink-0" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="company" className="mt-4">
            <CompanySettingsTab />
          </TabsContent>

          <TabsContent value="timezone" className="mt-4">
            <TimezoneSettingsTab />
          </TabsContent>

          <TabsContent value="system" className="mt-4">
            <SystemSettingsTab
              settings={systemSettings}
              saving={systemSaving}
              onSave={handleSystemSave}
              onUpdateSettings={updateSystemSettings}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="payment-terms" className="mt-4">
            <PaymentTermsSettings />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <div className="space-y-6">
              <NotificationSettingsTab />
              <InvoiceAlertSettings />
              <EmailNotificationSettingsSection />
              <WhatsAppSettingsSection />
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users" className="mt-4">
              <UserManagementTab />
            </TabsContent>
          )}

          <TabsContent value="categories" className="mt-4">
            <CategoriesTab />
          </TabsContent>

          <TabsContent value="inspection-equipment" className="mt-4">
            <InspectionEquipmentTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="audit" className="mt-4">
              <AuditTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="recovery" className="mt-4">
              <RecoveryCenterTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="liberation" className="mt-4">
              <AdminEmergencyPanel />
            </TabsContent>
          )}
        </Tabs>
      </SectionCard>
    </div>
  );
};

export default Settings;
