import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArchiveRestore,
  Bell,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DollarSign,
  Globe,
  Mail,
  MessageCircle,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  Tag,
  Tags,
  Target,
  Unlock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminEmergencyPanel } from "@/components/admin/AdminEmergencyPanel";
import { InvoiceAlertSettings } from "@/components/invoices/InvoiceAlertSettings";
import { AppearanceSettingsTab } from "@/components/settings/AppearanceSettingsTab";
import { AuditTab } from "@/components/settings/AuditTab";
import { CategoriesTab } from "@/components/settings/CategoriesTab";
import { CompanySettingsTab } from "@/components/settings/CompanySettingsTab";
import { EmailNotificationSettingsSection } from "@/components/settings/EmailNotificationSettingsSection";
import { InspectionEquipmentTab } from "@/components/settings/InspectionEquipmentTab";
import { ChecklistMasterTab } from "@/components/settings/ChecklistMasterTab";
import { NotificationSettingsTab } from "@/components/settings/NotificationSettingsTab";
import { PaymentTermsSettings } from "@/components/settings/PaymentTermsSettings";
import { RecoveryCenterTab } from "@/components/settings/RecoveryCenterTab";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { SystemSettingsTab } from "@/components/settings/SystemSettingsTab";
import { TimezoneSettingsTab } from "@/components/settings/TimezoneSettingsTab";
import { UserManagementTab } from "@/components/settings/UserManagementTab";
import { WhatsAppSettingsSection } from "@/components/settings/WhatsAppSettingsSection";
import { useSettings } from "@/hooks/useSettings";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";

const ServiceTypesSettings = React.lazy(() => import("@/pages/ServiceTypes"));
const ServiceRatesSettings = React.lazy(() => import("@/pages/ServiceRates"));
const CostCentersSettings = React.lazy(() => import("@/pages/CostCenters"));

interface SettingsSection {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  adminOnly?: boolean;
}

interface SettingsGroup {
  id: string;
  label: string;
  description: string;
  sections: SettingsSection[];
}

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "experience",
    label: "Experiencia",
    description: "Preferencias personales de uso.",
    sections: [
      {
        value: "appearance",
        label: "Apariencia",
        description: "Tema, densidad, lectura y menú lateral.",
        icon: Palette,
        keywords: ["tema", "oscuro", "claro", "densidad", "texto", "menú"],
      },
    ],
  },
  {
    id: "organization",
    label: "Organización",
    description: "Identidad y reglas comerciales.",
    sections: [
      {
        value: "company",
        label: "Empresa",
        description: "Identidad, datos legales, contacto y logo.",
        icon: Building2,
        keywords: ["empresa", "rut", "logo", "dirección", "contacto"],
      },
      {
        value: "timezone",
        label: "Zona horaria",
        description: "Hora local y formato de fechas.",
        icon: Globe,
        keywords: ["hora", "fecha", "zona", "formato"],
      },
      {
        value: "payment-terms",
        label: "Condiciones de pago",
        description: "Plazos y condiciones comerciales.",
        icon: CreditCard,
        keywords: ["pago", "plazo", "crédito", "condiciones"],
      },
    ],
  },
  {
    id: "catalogs",
    label: "Catálogos y costos",
    description: "Servicios, tarifas y estructura de costos.",
    sections: [
      {
        value: "service-types",
        label: "Tipos de servicio",
        description: "Catálogo operativo usado al crear servicios.",
        icon: Tags,
        keywords: ["tipos", "servicios", "catálogo", "operación"],
        adminOnly: true,
      },
      {
        value: "service-rates",
        label: "Tarifas de servicio",
        description: "Precios por cliente, servicio y ruta.",
        icon: DollarSign,
        keywords: ["tarifas", "precios", "clientes", "rutas"],
        adminOnly: true,
      },
      {
        value: "cost-centers",
        label: "Centros de costo",
        description: "Estructura presupuestaria y control de gastos.",
        icon: Target,
        keywords: ["centros", "costos", "presupuesto", "gastos"],
        adminOnly: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operación",
    description: "Reglas que usa el trabajo diario.",
    sections: [
      {
        value: "notifications",
        label: "Alertas y canales",
        description: "Notificaciones, correo, facturas y WhatsApp.",
        icon: Bell,
        keywords: [
          "alertas",
          "notificaciones",
          "correo",
          "email",
          "whatsapp",
          "facturas",
        ],
      },
      {
        value: "categories",
        label: "Categorías",
        description: "Clasificación de costos y proveedores.",
        icon: Tag,
        keywords: ["categorías", "costos", "proveedores", "clasificación"],
      },
      {
        value: "inspection-equipment",
        label: "Equipamiento de inspección",
        description: "Checklist operativo por tipo de grúa.",
        icon: ClipboardCheck,
        keywords: ["equipamiento", "inspección", "checklist", "grúa"],
      },
      {
        value: "checklist-master",
        label: "Checklists de Seguridad",
        description: "Ítems del pre-operacional y del control de fatiga.",
        icon: ShieldCheck,
        keywords: ["checklist", "seguridad", "pre-operacional", "fatiga", "faena"],
        adminOnly: true,
      },
    ],
  },
  {
    id: "access",
    label: "Acceso y trazabilidad",
    description: "Personas, permisos y actividad.",
    sections: [
      {
        value: "users",
        label: "Usuarios y permisos",
        description: "Cuentas, roles y acceso por módulo.",
        icon: Users,
        keywords: ["usuarios", "roles", "permisos", "cuentas", "acceso"],
        adminOnly: true,
      },
      {
        value: "audit",
        label: "Auditoría",
        description: "Historial de cambios y responsables.",
        icon: ClipboardList,
        keywords: ["auditoría", "historial", "cambios", "actividad"],
        adminOnly: true,
      },
    ],
  },
  {
    id: "integrity",
    label: "Sistema e integridad",
    description: "Mantenimiento y herramientas críticas.",
    sections: [
      {
        value: "system",
        label: "Sistema y respaldos",
        description: "Parámetros generales y copias de seguridad.",
        icon: SettingsIcon,
        keywords: ["sistema", "respaldos", "backup", "parámetros"],
      },
      {
        value: "recovery",
        label: "Centro de recuperación",
        description: "Reversión controlada de operaciones.",
        icon: ArchiveRestore,
        keywords: ["recuperación", "revertir", "restaurar", "operaciones"],
        adminOnly: true,
      },
      {
        value: "liberation",
        label: "Herramientas de emergencia",
        description: "Reparación y liberación administrativa.",
        icon: Unlock,
        keywords: ["emergencia", "liberación", "reparación", "administración"],
        adminOnly: true,
      },
    ],
  },
];

const NotificationsSettingsPanel = () => (
  <Tabs defaultValue="general" className="space-y-4">
    <div className="configuration-panel border border-border/70 bg-card/80 p-3 shadow-sm sm:p-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Canal de configuración
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Abre sólo el canal que necesitas ajustar.
        </p>
      </div>
      <TabsList className="h-auto w-full justify-start rounded-lg bg-muted/70 p-1">
        <TabsTrigger value="general" className="gap-2 py-2">
          <Bell className="size-4" />
          Generales
        </TabsTrigger>
        <TabsTrigger value="invoices" className="gap-2 py-2">
          <CreditCard className="size-4" />
          Facturas
        </TabsTrigger>
        <TabsTrigger value="email" className="gap-2 py-2">
          <Mail className="size-4" />
          Correo
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="gap-2 py-2">
          <MessageCircle className="size-4" />
          WhatsApp
        </TabsTrigger>
      </TabsList>
    </div>

    <TabsContent value="general" className="mt-0">
      <NotificationSettingsTab />
    </TabsContent>
    <TabsContent value="invoices" className="mt-0">
      <InvoiceAlertSettings />
    </TabsContent>
    <TabsContent value="email" className="mt-0">
      <EmailNotificationSettingsSection />
    </TabsContent>
    <TabsContent value="whatsapp" className="mt-0">
      <WhatsAppSettingsSection />
    </TabsContent>
  </Tabs>
);

const Settings = () => {
  const { settings, loading, resetSettings } = useSettings();
  const {
    systemSettings,
    loading: systemLoading,
    saving: systemSaving,
    updateSystemSettings,
    saveSettings: saveSystemSettings,
  } = useSystemSettings();
  const { isAdmin } = useUserPermissions();
  const [activeTab, setActiveTab] = React.useState("appearance");

  const visibleGroups = React.useMemo(
    () =>
      SETTINGS_GROUPS.map((group) => ({
        ...group,
        sections: group.sections.filter(
          (section) => !section.adminOnly || isAdmin,
        ),
      })).filter((group) => group.sections.length > 0),
    [isAdmin],
  );

  const visibleSections = React.useMemo(
    () => visibleGroups.flatMap((group) => group.sections),
    [visibleGroups],
  );

  const activeSection =
    visibleSections.find((section) => section.value === activeTab) ??
    visibleSections[0];
  const activeGroup = visibleGroups.find((group) =>
    group.sections.some((section) => section.value === activeSection?.value),
  );
  const activePosition =
    visibleSections.findIndex(
      (section) => section.value === activeSection?.value,
    ) + 1;

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;

      const target = hash === "respaldos" ? "system" : hash;
      if (!visibleSections.some((section) => section.value === target)) return;

      setActiveTab(target);
      if (hash === "respaldos") {
        window.setTimeout(() => {
          document
            .getElementById("respaldos")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [visibleSections]);

  const handleSectionChange = (value: string) => {
    setActiveTab(value);
    const nextUrl = `${window.location.pathname}${window.location.search}#${value}`;
    window.history.replaceState(null, "", nextUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSystemSave = async () => {
    const result = await saveSystemSettings();
    if (result.success) {
      toast.success("Configuración del sistema guardada", {
        description: "Los cambios se han guardado correctamente.",
      });
    } else {
      toast.error("Error al guardar", {
        description:
          result.error || "No se pudo guardar la configuración del sistema.",
      });
    }
  };

  const renderDeferredSection = (section: React.ReactNode) => (
    <React.Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      }
    >
      {section}
    </React.Suspense>
  );

  const renderActiveSection = () => {
    switch (activeSection?.value) {
      case "appearance":
        return <AppearanceSettingsTab />;
      case "company":
        return <CompanySettingsTab />;
      case "timezone":
        return <TimezoneSettingsTab />;
      case "system":
        return (
          <SystemSettingsTab
            settings={systemSettings}
            saving={systemSaving}
            onSave={handleSystemSave}
            onUpdateSettings={updateSystemSettings}
            isAdmin={isAdmin}
          />
        );
      case "payment-terms":
        return <PaymentTermsSettings />;
      case "service-types":
        return renderDeferredSection(<ServiceTypesSettings />);
      case "service-rates":
        return renderDeferredSection(<ServiceRatesSettings />);
      case "cost-centers":
        return renderDeferredSection(<CostCentersSettings />);
      case "notifications":
        return <NotificationsSettingsPanel />;
      case "users":
        return isAdmin ? <UserManagementTab /> : null;
      case "categories":
        return <CategoriesTab />;
      case "inspection-equipment":
        return <InspectionEquipmentTab />;
      case "checklist-master":
        // adminOnly en la definición esconde la entrada; este guard evita que se
        // renderice si alguien llega por URL con el estado ya restaurado.
        return isAdmin ? <ChecklistMasterTab /> : null;
      case "audit":
        return isAdmin ? <AuditTab /> : null;
      case "recovery":
        return isAdmin ? <RecoveryCenterTab /> : null;
      case "liberation":
        return isAdmin ? <AdminEmergencyPanel /> : null;
      default:
        return null;
    }
  };

  if (loading || systemLoading || !settings || !activeSection) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="settings-concept min-h-screen space-y-6 overflow-x-hidden pb-6 animate-fade-in">
      <SettingsHeader onReset={resetSettings} />

      <nav
        aria-label="Secciones de configuración"
        className="configuration-panel overflow-hidden border border-border/70 bg-card/80 shadow-sm"
      >
        <div className="p-3 xl:hidden sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {activeGroup?.label}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {activeSection.description}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full">
              {activePosition}/{visibleSections.length}
            </Badge>
          </div>
          <Select
            value={activeSection.value}
            onValueChange={handleSectionChange}
          >
            <SelectTrigger
              aria-label="Cambiar sección de configuración"
              className="h-11 bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleGroups.map((group) => (
                <SelectGroup key={group.id}>
                  <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </SelectLabel>
                  {group.sections.map((section) => (
                    <SelectItem key={section.value} value={section.value}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden xl:block">
          <div className="flex border-b border-border/70 bg-muted/25">
            {visibleGroups.map((group, groupIndex) => {
              const isActive = group.id === activeGroup?.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSectionChange(group.sections[0].value)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "relative min-w-0 flex-1 border-r border-border/70 px-4 py-3 text-left transition-colors last:border-r-0",
                    isActive
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-xs font-semibold",
                        isActive && "text-primary",
                      )}
                    >
                      {String(groupIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-xs font-semibold uppercase tracking-wide">
                      {group.label}
                    </span>
                    <span className="ml-auto text-xs tabular-nums">
                      {group.sections.length}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs">
                    {group.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 p-3">
            {activeGroup?.sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.value === activeSection.value;
              return (
                <button
                  key={section.value}
                  type="button"
                  onClick={() => handleSectionChange(section.value)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                      : "border-border/70 bg-background/50 text-muted-foreground hover:border-border-strong hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md border",
                      isActive
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {section.label}
                      </span>
                      {section.adminOnly && (
                        <ShieldCheck
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="Sólo administradores"
                        />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="min-w-0">
        <div key={activeSection.value} className="animate-fade-in">
          {renderActiveSection()}
        </div>
      </main>
    </div>
  );
};

export default Settings;
