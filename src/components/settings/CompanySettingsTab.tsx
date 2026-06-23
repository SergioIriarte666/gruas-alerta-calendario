
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/useSettings';
import { useLogoUpdater } from '@/hooks/useLogoUpdater';
import { LogoUpload } from './LogoUpload';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRut } from '@/utils/rutFormatter';
import {
  useCompanyProfiles,
  useSaveCompanyProfile,
  useUpdateCompanyProfileLogo,
} from '@/hooks/useCompanyProfiles';

const inputClassName = 'border-border/70 bg-background/60';
const sectionCardClassName = 'border-border/70 bg-card/80 shadow-sm';

export const CompanySettingsTab = () => {
  const { settings, updateSettings, saveSettings, saving } = useSettings();
  const { isUpdating: isLogoUpdating, updateLogo } = useLogoUpdater();
  const [localSettings, setLocalSettings] = useState(settings.company);
  const [selectedProfileRut, setSelectedProfileRut] = useState<string>('__new__');
  const [profileForm, setProfileForm] = useState({
    rut: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '' as string | undefined
  });
  const [updatingProfileLogo, setUpdatingProfileLogo] = useState(false);

  const { data: companyProfiles = [] } = useCompanyProfiles();
  const saveProfileMutation = useSaveCompanyProfile();
  const updateLogoMutation = useUpdateCompanyProfileLogo();

  React.useEffect(() => {
    setLocalSettings(settings.company);
  }, [settings.company]);

  React.useEffect(() => {
    if (selectedProfileRut === '__new__') {
      setProfileForm({ rut: '', name: '', address: '', phone: '', email: '', logoUrl: undefined });
      return;
    }
    const found = companyProfiles.find(p => p.rut === selectedProfileRut);
    if (found) {
      setProfileForm({
        rut: found.rut,
        name: found.name,
        address: found.address || '',
        phone: found.phone || '',
        email: found.email || '',
        logoUrl: found.logo_url || undefined
      });
    }
  }, [selectedProfileRut, companyProfiles]);

  const handleInputChange = (field: string, value: string | number) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
    updateSettings({ company: { ...settings.company, [field]: value } });
  };

  const handleSave = async () => {
    const result = await saveSettings();
    if (result.success) {
      toast.success("Configuración guardada", {
        description: "Los datos de la empresa se han guardado correctamente."
      });
    } else {
      toast.error("Error al guardar", {
        description: result.error || "No se pudo guardar la configuración de la empresa."
      });
    }
  };

  const handleLogoChange = async (logoFile: File | null) => {
    const result = await updateLogo(logoFile, settings);
    if (result.success) {
      toast.success("Logotipo actualizado", {
        description: "El logotipo se ha actualizado correctamente."
      });
    } else {
      toast.error("Error al actualizar logotipo", {
        description: result.error || "No se pudo actualizar el logotipo."
      });
    }
  };

  const saveCompanyProfile = async () => {
    if (!profileForm.rut.trim() || !profileForm.name.trim()) {
      toast.error('Datos incompletos', { description: 'RUT y Nombre son obligatorios.' });
      return;
    }
    await saveProfileMutation.mutateAsync({
      rut: profileForm.rut.trim(),
      name: profileForm.name.trim(),
      address: profileForm.address.trim() || null,
      phone: profileForm.phone.trim() || null,
      email: profileForm.email.trim() || null,
      logo_url: profileForm.logoUrl || null,
    });
    setSelectedProfileRut(profileForm.rut.trim());
    toast.success('Empresa guardada', { description: 'Se guardó el perfil de empresa para encabezados y logotipo.' });
  };

  const handleProfileLogoChange = async (logoFile: File | null) => {
    if (!profileForm.rut.trim() || !profileForm.name.trim()) {
      toast.error('Primero completa RUT y Nombre', { description: 'Guarda la empresa antes de subir el logotipo.' });
      return;
    }
    setUpdatingProfileLogo(true);
    try {
      const existing = companyProfiles.find(p => p.rut === profileForm.rut.trim());
      const newLogoUrl = await updateLogoMutation.mutateAsync({
        rut: profileForm.rut.trim(),
        name: profileForm.name.trim(),
        address: profileForm.address,
        phone: profileForm.phone,
        email: profileForm.email,
        logoFile,
        currentLogoUrl: existing?.logo_url ?? null,
      });
      setProfileForm(prev => ({ ...prev, logoUrl: newLogoUrl || undefined }));
      toast.success('Logotipo actualizado', { description: 'El logotipo de la empresa se actualizó correctamente.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo actualizar el logotipo.';
      toast.error('Error al actualizar logotipo', { description: msg });
    } finally {
      setUpdatingProfileLogo(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={sectionCardClassName}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg text-foreground sm:text-xl">Información de la empresa</CardTitle>
          <CardDescription>
            Define los datos legales y operativos que se usarán en encabezados, documentos y folios del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessName">Nombre de la empresa</Label>
              <Input
                id="businessName"
                value={localSettings.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nombre de la empresa"
                className={inputClassName}
              />
            </div>
            <div>
              <Label htmlFor="taxId">RUT</Label>
              <Input
                id="taxId"
                value={localSettings.taxId}
                onChange={(e) => handleInputChange('taxId', e.target.value)}
                placeholder="RUT de la empresa"
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={localSettings.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Dirección completa de la empresa"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <PhoneInput
                id="phone"
                value={localSettings.phone ?? ''}
                onChange={(v) => handleInputChange('phone', v)}
                placeholder="9 XXXX XXXX"
                className={inputClassName}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={localSettings.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Email de contacto"
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="folioFormat">Formato de folio</Label>
            <Input
              id="folioFormat"
              value={localSettings.folioFormat}
              onChange={(e) => handleInputChange('folioFormat', e.target.value)}
              placeholder="SRV-{number}"
              className={inputClassName}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Use {'{number}'} donde quiere que aparezca el número consecutivo
            </p>
          </div>

          <div>
            <Label htmlFor="nextFolioNumber">Próximo número de folio</Label>
            <Input
              id="nextFolioNumber"
              type="number"
              value={localSettings.nextServiceFolioNumber}
              onChange={(e) => handleInputChange('nextServiceFolioNumber', parseInt(e.target.value || '0', 10) || 0)}
              placeholder="1000"
              className={inputClassName}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={sectionCardClassName}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg text-foreground sm:text-xl">Logotipo principal</CardTitle>
          <CardDescription>
            Actualiza la imagen corporativa que se muestra en la navegación y en los documentos generados.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <LogoUpload
            currentLogo={localSettings.logo}
            onLogoChange={handleLogoChange}
            disabled={isLogoUpdating}
            labelClassName="text-foreground"
          />
        </CardContent>
      </Card>

      <Card className={sectionCardClassName}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg text-foreground sm:text-xl">Empresas adicionales</CardTitle>
          <CardDescription>
            Gestiona perfiles alternativos para encabezados, branding y emisión de documentos por empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seleccionar empresa</Label>
              <Select value={selectedProfileRut} onValueChange={setSelectedProfileRut}>
                <SelectTrigger className={inputClassName}>
                  <SelectValue placeholder="Nueva empresa" />
                </SelectTrigger>
                <SelectContent className="bg-popover border z-50">
                  <SelectItem value="__new__">Nueva empresa</SelectItem>
                  {companyProfiles.map(p => (
                    <SelectItem key={p.rut} value={p.rut}>
                      {p.name} ({p.rut})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>RUT</Label>
              <Input
                value={profileForm.rut}
                onChange={(e) => setProfileForm(prev => ({ ...prev, rut: formatRut(e.target.value) }))}
                placeholder="13.222.170-7"
                className={inputClassName}
                disabled={selectedProfileRut !== '__new__'}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="LowBoy Chile SpA"
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <Label>Dirección</Label>
            <Textarea
              value={profileForm.address}
              onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Dirección completa"
              className={inputClassName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Teléfono</Label>
              <PhoneInput
                value={profileForm.phone}
                onChange={(v) => setProfileForm(prev => ({ ...prev, phone: v }))}
                placeholder="9 XXXX XXXX"
                className={inputClassName}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@..."
                className={inputClassName}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/50 p-4">
            <LogoUpload
              currentLogo={profileForm.logoUrl}
              onLogoChange={handleProfileLogoChange}
              disabled={updatingProfileLogo}
              labelClassName="text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={saveCompanyProfile} disabled={saveProfileMutation.isPending}>
              {saveProfileMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Guardar Empresa
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
