import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Building2,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  FileCheck2,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { usePortalAccount } from "@/hooks/portal/usePortalAccount";
import type { PortalNotificationPreferences } from "@/hooks/portal/usePortalAccount";
import { useReAuth } from "@/hooks/useReAuth";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/logger";
import { businessClock } from "@/utils/businessClock";
import { validatePassword } from "@/utils/passwordValidation";
import { toast } from "sonner";

const logger = createLogger("PortalAccount");

const getInitials = (value?: string | null) => {
  if (!value) return "CL";
  if (value.includes("@") && !value.includes(" ")) {
    return value.slice(0, 2).toUpperCase();
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatLastAccess = (value?: string) => {
  if (!value) return "Sesión actual protegida";

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: businessClock.timezone(),
  }).format(new Date(value));
};

interface PreferenceRowProps {
  icon: typeof BellRing;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const PreferenceRow = ({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: PreferenceRowProps) => (
  <div className="portal-account-preference">
    <span>
      <Icon />
    </span>
    <div>
      <Label>{title}</Label>
      <p>{description}</p>
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={title}
    />
  </div>
);

const PortalAccount = () => {
  const { user, updateUser } = useUser();
  const { user: authUser, signOut } = useAuth();
  const { verifyPassword } = useReAuth();
  const { settings } = useSettings();
  const {
    company,
    billingContacts,
    isLoadingAccount,
    accountError,
    preferences,
    isLoadingPreferences,
    savePreferences,
  } = usePortalAccount();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [requestedEmail, setRequestedEmail] = useState(user?.email ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localPreferences, setLocalPreferences] =
    useState<PortalNotificationPreferences>(preferences);

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setRequestedEmail(user?.email ?? "");
    setAvatarLoadFailed(false);
  }, [user?.avatar_url, user?.email, user?.name, user?.phone]);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const companyName =
    company?.display_name || company?.name || "Empresa cliente";
  const displayUserName =
    user?.name &&
    user.name.trim().toLowerCase() !== user.email.trim().toLowerCase()
      ? user.name
      : "Usuario principal";
  const accountInitials = useMemo(
    () => getInitials(user?.name || user?.email),
    [user?.email, user?.name],
  );
  const avatarSource = useMemo(() => {
    const source = user?.avatar_url;
    if (!source || avatarLoadFailed) return undefined;

    const publicAvatarMarker = "/object/public/avatars/";
    if (
      source.includes(publicAvatarMarker) &&
      !source.includes(`${publicAvatarMarker}${user.id}/`)
    ) {
      return undefined;
    }

    return source;
  }, [avatarLoadFailed, user?.avatar_url, user?.id]);

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedName = name.trim();

    if (normalizedName.length < 2) {
      toast.error("Revisa tu nombre", {
        description: "Debe contener al menos dos caracteres.",
      });
      return;
    }

    setProfileSaving(true);
    try {
      await updateUser({
        name: normalizedName,
        phone: phone.trim() || null,
      });
      toast.success("Perfil actualizado", {
        description: "Tus datos de contacto quedaron guardados.",
      });
    } catch (error) {
      logger.error("No se pudo actualizar el perfil", error);
      toast.error("No se pudo guardar el perfil", {
        description: "Inténtalo nuevamente.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5 MB");
      return;
    }

    setAvatarSaving(true);
    try {
      const extensionByMime: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const extension = extensionByMime[file.type] || "jpg";
      const path = `${user.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        logger.error(
          `Storage rechazó el avatar (${uploadError.statusCode ?? "sin estado"}): ${uploadError.message}`,
        );
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateUser({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      toast.success("Fotografía actualizada");
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Inténtalo nuevamente.";
      logger.error(`No se pudo actualizar la fotografía: ${message}`);
      toast.error("No se pudo subir la fotografía", {
        description: message,
      });
    } finally {
      setAvatarSaving(false);
      event.target.value = "";
    }
  };

  const handleEmailChange = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = requestedEmail.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      toast.error("Ingresa un correo válido");
      return;
    }
    if (normalizedEmail === user?.email?.toLowerCase()) {
      toast.info("Este ya es tu correo de acceso");
      return;
    }

    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });
      if (error) throw error;

      setRequestedEmail(user?.email ?? "");
      toast.success("Solicitud de cambio enviada", {
        description:
          "Revisa los mensajes de confirmación antes de que el nuevo correo quede activo.",
      });
    } catch (error) {
      logger.error("No se pudo solicitar el cambio de correo", error);
      toast.error("No se pudo cambiar el correo", {
        description:
          error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentPassword) {
      toast.error("Ingresa tu contraseña actual");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error("La nueva contraseña no cumple los requisitos", {
        description: validation.error,
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await verifyPassword(currentPassword);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada", {
        description: "Tu acceso quedó protegido con la nueva contraseña.",
      });
    } catch (error) {
      logger.error("No se pudo cambiar la contraseña", error);
      toast.error("No se pudo cambiar la contraseña", {
        description:
          "Comprueba tu contraseña actual y vuelve a intentarlo.",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const updatePreference = (
    key: keyof PortalNotificationPreferences,
    checked: boolean,
  ) => {
    if (
      (key === "email_enabled" || key === "portal_enabled") &&
      !checked &&
      !localPreferences[
        key === "email_enabled" ? "portal_enabled" : "email_enabled"
      ]
    ) {
      toast.info("Mantén al menos un canal activo");
      return;
    }

    setLocalPreferences((current) => ({ ...current, [key]: checked }));
  };

  const handleCompanyUpdateRequest = () => {
    const supportEmail = settings.company.email?.trim();
    if (!supportEmail) {
      toast.info("Contacta a soporte operacional", {
        description:
          "Solicita la actualización de los datos legales de tu empresa.",
      });
      return;
    }

    const subject = encodeURIComponent(
      `Solicitud de actualización de datos — ${companyName}`,
    );
    const body = encodeURIComponent(
      `Hola,\n\nSolicito revisar los datos de empresa visibles en el Portal Clientes para ${companyName}.\n\nRUT: ${company?.rut || "Sin información"}\nUsuario: ${user?.email || ""}\n\nDetalle del cambio:\n`,
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="portal-page portal-account-page">
      <PortalPageHeader
        eyebrow="Gestión de cuenta"
        title="Cuenta y perfil"
        description="Administra tu identidad, los datos de tu empresa, tus preferencias y la seguridad del acceso."
        icon={CircleUserRound}
      />

      <section className="portal-account-identity">
        <div className="portal-account-identity__avatar">
          <Avatar>
            <AvatarImage
              src={avatarSource}
              alt={user?.name}
              onLoadingStatusChange={(status) =>
                setAvatarLoadFailed(status === "error")
              }
            />
            <AvatarFallback className="portal-account-identity__fallback">
              {accountInitials}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarSaving}
            aria-label="Cambiar fotografía"
          >
            {avatarSaving ? <Loader2 className="animate-spin" /> : <Camera />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
        <div className="portal-account-identity__copy">
          <span>Cuenta de cliente</span>
          <h2>{companyName}</h2>
          <strong>{displayUserName}</strong>
          <small>{user?.email}</small>
        </div>
        <div className="portal-account-identity__status">
          <Badge>
            <Check />
            Cuenta activa
          </Badge>
          <p>
            <ShieldCheck />
            Acceso protegido
          </p>
        </div>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="portal-account-workspace"
      >
        <TabsList className="portal-account-nav">
          <TabsTrigger value="profile">
            <UserRound />
            <span>
              <strong>Mi perfil</strong>
              <small>Identidad y contacto</small>
            </span>
            <ChevronRight />
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 />
            <span>
              <strong>Empresa</strong>
              <small>Datos legales y contactos</small>
            </span>
            <ChevronRight />
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <BellRing />
            <span>
              <strong>Preferencias</strong>
              <small>Avisos y canales</small>
            </span>
            <ChevronRight />
          </TabsTrigger>
          <TabsTrigger value="security">
            <LockKeyhole />
            <span>
              <strong>Seguridad</strong>
              <small>Contraseña y sesiones</small>
            </span>
            <ChevronRight />
          </TabsTrigger>
        </TabsList>

        <div className="portal-account-content">
          <TabsContent value="profile">
            <div className="portal-account-section-heading">
              <span>01</span>
              <div>
                <h3>Mi perfil</h3>
                <p>
                  Mantén actualizada la información con la que coordinamos tus
                  solicitudes.
                </p>
              </div>
            </div>

            <Card className="portal-account-card">
              <CardHeader>
                <CardTitle>Información personal</CardTitle>
                <CardDescription>
                  Estos datos identifican al usuario dentro del Portal Clientes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="portal-account-form"
                  onSubmit={handleProfileSubmit}
                >
                  <div>
                    <Label htmlFor="portal-account-name">Nombre completo</Label>
                    <Input
                      id="portal-account-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portal-account-phone">
                      Teléfono de contacto
                    </Label>
                    <PhoneInput
                      id="portal-account-phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="9 1234 5678"
                    />
                  </div>
                  <div className="portal-account-form__actions">
                    <Button
                      type="submit"
                      className="portal-account-primary-action"
                      disabled={profileSaving}
                    >
                      {profileSaving ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Save />
                      )}
                      {profileSaving ? "Guardando…" : "Guardar cambios"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="portal-account-card">
              <CardHeader>
                <CardTitle>Correo de acceso</CardTitle>
                <CardDescription>
                  El cambio solo se completa después de confirmar el nuevo
                  correo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="portal-account-email-form"
                  onSubmit={handleEmailChange}
                >
                  <div>
                    <Label htmlFor="portal-account-email">Nuevo correo</Label>
                    <div className="portal-account-input-icon">
                      <Mail />
                      <Input
                        id="portal-account-email"
                        type="email"
                        value={requestedEmail}
                        onChange={(event) =>
                          setRequestedEmail(event.target.value)
                        }
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      emailSaving ||
                      requestedEmail.trim().toLowerCase() ===
                        user?.email?.toLowerCase()
                    }
                  >
                    {emailSaving ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Send />
                    )}
                    Solicitar cambio
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <div className="portal-account-section-heading">
              <span>02</span>
              <div>
                <h3>Datos de la empresa</h3>
                <p>
                  Información comercial asociada a servicios, órdenes de compra
                  y facturación.
                </p>
              </div>
            </div>

            <Card className="portal-account-card">
              <CardHeader className="portal-account-card__split-heading">
                <div>
                  <CardTitle>Identidad empresarial</CardTitle>
                  <CardDescription>
                    Los datos legales están protegidos contra cambios
                    accidentales.
                  </CardDescription>
                </div>
                <Badge variant="outline">Solo lectura</Badge>
              </CardHeader>
              <CardContent>
                {isLoadingAccount ? (
                  <div className="portal-account-loading">
                    <Loader2 className="animate-spin" />
                    Cargando datos de empresa…
                  </div>
                ) : accountError ? (
                  <div className="portal-account-empty">
                    No pudimos cargar la información de la empresa.
                  </div>
                ) : (
                  <div className="portal-company-data">
                    <div>
                      <Building2 />
                      <span>
                        <small>Razón social</small>
                        <strong>{company?.name || "Sin información"}</strong>
                      </span>
                    </div>
                    <div>
                      <FileCheck2 />
                      <span>
                        <small>RUT</small>
                        <strong>{company?.rut || "Sin información"}</strong>
                      </span>
                    </div>
                    <div>
                      <MapPin />
                      <span>
                        <small>Dirección</small>
                        <strong>{company?.address || "Sin información"}</strong>
                      </span>
                    </div>
                    <div>
                      <Phone />
                      <span>
                        <small>Teléfono empresa</small>
                        <strong>{company?.phone || "Sin información"}</strong>
                      </span>
                    </div>
                    <div>
                      <Mail />
                      <span>
                        <small>Correo empresa</small>
                        <strong>{company?.email || "Sin información"}</strong>
                      </span>
                    </div>
                    <div>
                      <UserRound />
                      <span>
                        <small>Contacto principal</small>
                        <strong>
                          {company?.contact_name || "Sin información"}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
                <div className="portal-company-update">
                  <p>
                    Si algún dato no está vigente, nuestro equipo debe validarlo
                    antes de modificarlo.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCompanyUpdateRequest}
                  >
                    <Send />
                    Solicitar actualización
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="portal-account-card">
              <CardHeader>
                <CardTitle>Contactos de facturación</CardTitle>
                <CardDescription>
                  Personas que reciben documentación y avisos de cobranza.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {billingContacts.length === 0 ? (
                  <div className="portal-account-empty">
                    <ReceiptText />
                    <div>
                      <strong>Sin contactos adicionales</strong>
                      <p>Se utilizará el correo principal de la empresa.</p>
                    </div>
                  </div>
                ) : (
                  <div className="portal-billing-contacts">
                    {billingContacts.map((contact) => (
                      <article key={contact.id}>
                        <span>{getInitials(contact.name)}</span>
                        <div>
                          <strong>{contact.name}</strong>
                          <p>{contact.position || "Contacto de facturación"}</p>
                          <small>{contact.email}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences">
            <div className="portal-account-section-heading">
              <span>03</span>
              <div>
                <h3>Preferencias de notificación</h3>
                <p>
                  Decide qué novedades operativas son relevantes para tu
                  trabajo.
                </p>
              </div>
            </div>

            <Card className="portal-account-card">
              <CardHeader>
                <CardTitle>Avisos que deseas recibir</CardTitle>
                <CardDescription>
                  Puedes volver a activar o desactivar estas opciones cuando lo
                  necesites.
                </CardDescription>
              </CardHeader>
              <CardContent className="portal-account-preferences-list">
                <PreferenceRow
                  icon={BellRing}
                  title="Cambios de estado de servicios"
                  description="Asignación, traslado, llegada y finalización."
                  checked={localPreferences.service_updates}
                  onCheckedChange={(checked) =>
                    updatePreference("service_updates", checked)
                  }
                />
                <PreferenceRow
                  icon={Send}
                  title="Actualizaciones de solicitudes"
                  description="Confirmación, revisión y respuesta operacional."
                  checked={localPreferences.request_updates}
                  onCheckedChange={(checked) =>
                    updatePreference("request_updates", checked)
                  }
                />
                <PreferenceRow
                  icon={FileCheck2}
                  title="Órdenes de compra pendientes"
                  description="Servicios que requieren adjuntar una O.C."
                  checked={localPreferences.purchase_order_alerts}
                  onCheckedChange={(checked) =>
                    updatePreference("purchase_order_alerts", checked)
                  }
                />
                <PreferenceRow
                  icon={FileText}
                  title="Facturas y vencimientos"
                  description="Emisión de documentos y saldos próximos a vencer."
                  checked={localPreferences.invoice_alerts}
                  onCheckedChange={(checked) =>
                    updatePreference("invoice_alerts", checked)
                  }
                />
              </CardContent>
            </Card>

            <Card className="portal-account-card">
              <CardHeader>
                <CardTitle>Canales activos</CardTitle>
                <CardDescription>
                  Debes mantener al menos un canal para comunicaciones
                  importantes.
                </CardDescription>
              </CardHeader>
              <CardContent className="portal-account-preferences-list">
                <PreferenceRow
                  icon={Mail}
                  title="Correo electrónico"
                  description={user?.email || "Correo principal de la cuenta"}
                  checked={localPreferences.email_enabled}
                  onCheckedChange={(checked) =>
                    updatePreference("email_enabled", checked)
                  }
                />
                <PreferenceRow
                  icon={Smartphone}
                  title="Notificaciones en el portal"
                  description="Avisos visibles al iniciar sesión."
                  checked={localPreferences.portal_enabled}
                  onCheckedChange={(checked) =>
                    updatePreference("portal_enabled", checked)
                  }
                />
                <div className="portal-account-preferences-save">
                  <Button
                    type="button"
                    className="portal-account-primary-action"
                    disabled={
                      isLoadingPreferences || savePreferences.isPending
                    }
                    onClick={() => savePreferences.mutate(localPreferences)}
                  >
                    {savePreferences.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    Guardar preferencias
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <div className="portal-account-section-heading">
              <span>04</span>
              <div>
                <h3>Seguridad de la cuenta</h3>
                <p>
                  Protege tus credenciales y controla las sesiones vinculadas.
                </p>
              </div>
            </div>

            <Card className="portal-account-card portal-account-session-card">
              <CardContent>
                <span>
                  <ShieldCheck />
                </span>
                <div>
                  <small>Último acceso</small>
                  <strong>
                    {formatLastAccess(authUser?.last_sign_in_at)}
                  </strong>
                  <p>La sesión actual está cifrada y activa.</p>
                </div>
                <Button type="button" variant="outline" onClick={signOut}>
                  <LogOut />
                  Cerrar todas las sesiones
                </Button>
              </CardContent>
            </Card>

            <Card className="portal-account-card">
              <CardHeader>
                <CardTitle>Cambiar contraseña</CardTitle>
                <CardDescription>
                  Verificaremos tu contraseña actual antes de guardar la nueva.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="portal-account-password-form"
                  onSubmit={handlePasswordChange}
                >
                  <div>
                    <Label htmlFor="portal-current-password">
                      Contraseña actual
                    </Label>
                    <Input
                      id="portal-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portal-new-password">
                      Nueva contraseña
                    </Label>
                    <Input
                      id="portal-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portal-confirm-password">
                      Confirmar nueva contraseña
                    </Label>
                    <Input
                      id="portal-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="portal-account-password-hint">
                    <KeyRound />
                    Usa al menos 12 caracteres y combina letras, números y
                    símbolos.
                  </p>
                  <div className="portal-account-form__actions">
                    <Button
                      type="submit"
                      className="portal-account-primary-action"
                      disabled={
                        passwordSaving ||
                        !currentPassword ||
                        !newPassword ||
                        !confirmPassword
                      }
                    >
                      {passwordSaving ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <LockKeyhole />
                      )}
                      Actualizar contraseña
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="portal-account-danger-zone">
              <p>Control de la cuenta</p>
              <DeleteAccountSection />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default PortalAccount;
