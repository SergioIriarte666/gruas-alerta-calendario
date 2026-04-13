
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/useSettings';
import { useLogoUpdater } from '@/hooks/useLogoUpdater';
import { LogoUpload } from './LogoUpload';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRut } from '@/utils/rutFormatter';

export const CompanySettingsTab = () => {
  const { settings, updateSettings, saveSettings, saving } = useSettings();
  const { isUpdating: isLogoUpdating, updateLogo } = useLogoUpdater();
  const [localSettings, setLocalSettings] = useState(settings.company);
  const [companyProfiles, setCompanyProfiles] = useState<Array<{
    rut: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
  }>>([]);
  const [selectedProfileRut, setSelectedProfileRut] = useState<string>('__new__');
  const [profileForm, setProfileForm] = useState({
    rut: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '' as string | undefined
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingProfileLogo, setUpdatingProfileLogo] = useState(false);

  React.useEffect(() => {
    setLocalSettings(settings.company);
  }, [settings.company]);

  React.useEffect(() => {
    const loadProfiles = async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('rut, name, address, phone, email, logo_url')
        .order('name', { ascending: true });
      if (error) {
        setCompanyProfiles([]);
        return;
      }
      setCompanyProfiles(data || []);
    };
    loadProfiles();
  }, []);

  React.useEffect(() => {
    if (selectedProfileRut === '__new__') {
      setProfileForm({
        rut: '',
        name: '',
        address: '',
        phone: '',
        email: '',
        logoUrl: undefined
      });
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
    setSavingProfile(true);
    const payload = {
      rut: profileForm.rut.trim(),
      name: profileForm.name.trim(),
      address: profileForm.address.trim() || null,
      phone: profileForm.phone.trim() || null,
      email: profileForm.email.trim() || null,
      logo_url: profileForm.logoUrl || null
    };
    const { error } = await supabase.from('company_profiles').upsert(payload, { onConflict: 'rut' });
    setSavingProfile(false);
    if (error) {
      toast.error('Error al guardar', { description: error.message });
      return;
    }
    const { data, error: refreshError } = await supabase
      .from('company_profiles')
      .select('rut, name, address, phone, email, logo_url')
      .order('name', { ascending: true });
    if (!refreshError) setCompanyProfiles(data || []);
    setSelectedProfileRut(payload.rut);
    toast.success('Empresa guardada', { description: 'Se guardó el perfil de empresa para encabezados y logotipo.' });
  };

  const handleProfileLogoChange = async (logoFile: File | null) => {
    if (!profileForm.rut.trim() || !profileForm.name.trim()) {
      toast.error('Primero completa RUT y Nombre', { description: 'Guarda la empresa antes de subir el logotipo.' });
      return;
    }
    setUpdatingProfileLogo(true);
    try {
      const rut = profileForm.rut.trim();
      const existing = companyProfiles.find(p => p.rut === rut);
      const oldLogoUrl = existing?.logo_url || null;

      let newLogoUrlForDB: string | null = oldLogoUrl;
      let newLogoPath: string | undefined;

      if (logoFile) {
        newLogoPath = `public/company-profile-${rut}-${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage.from('company-assets').upload(newLogoPath, logoFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(newLogoPath);
        newLogoUrlForDB = urlData.publicUrl;
      } else if (logoFile === null) {
        newLogoUrlForDB = null;
      }

      const { error: upsertError } = await supabase
        .from('company_profiles')
        .upsert({
          rut,
          name: profileForm.name.trim(),
          address: profileForm.address.trim() || null,
          phone: profileForm.phone.trim() || null,
          email: profileForm.email.trim() || null,
          logo_url: newLogoUrlForDB
        }, { onConflict: 'rut' });
      if (upsertError) {
        if (newLogoPath) await supabase.storage.from('company-assets').remove([newLogoPath]);
        throw upsertError;
      }

      if (oldLogoUrl && newLogoUrlForDB !== oldLogoUrl) {
        const oldLogoPath = oldLogoUrl.split('/company-assets/')[1]?.split('?')[0];
        if (oldLogoPath) {
          await supabase.storage.from('company-assets').remove([oldLogoPath]);
        }
      }

      setProfileForm(prev => ({ ...prev, logoUrl: newLogoUrlForDB || undefined }));
      const { data, error: refreshError } = await supabase
        .from('company_profiles')
        .select('rut, name, address, phone, email, logo_url')
        .order('name', { ascending: true });
      if (!refreshError) setCompanyProfiles(data || []);
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
      <Card className="bg-card border">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-black text-lg sm:text-xl">Información de la Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessName" className="text-black">Nombre de la Empresa</Label>
              <Input
                id="businessName"
                value={localSettings.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nombre de la empresa"
                className="bg-white border-gray-300 text-black"
              />
            </div>
            <div>
              <Label htmlFor="taxId" className="text-black">RUT</Label>
              <Input
                id="taxId"
                value={localSettings.taxId}
                onChange={(e) => handleInputChange('taxId', e.target.value)}
                placeholder="RUT de la empresa"
                className="bg-white border-gray-300 text-black"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address" className="text-black">Dirección</Label>
            <Textarea
              id="address"
              value={localSettings.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Dirección completa de la empresa"
              className="bg-white border-gray-300 text-black"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="text-black">Teléfono</Label>
              <Input
                id="phone"
                value={localSettings.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Teléfono de contacto"
                className="bg-white border-gray-300 text-black"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-black">Email</Label>
              <Input
                id="email"
                type="email"
                value={localSettings.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Email de contacto"
                className="bg-white border-gray-300 text-black"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="folioFormat" className="text-black">Formato de Folio</Label>
            <Input
              id="folioFormat"
              value={localSettings.folioFormat}
              onChange={(e) => handleInputChange('folioFormat', e.target.value)}
              placeholder="SRV-{number}"
              className="bg-white border-gray-300 text-black"
            />
            <p className="text-sm text-gray-600 mt-1">
              Use {'{number}'} donde quiere que aparezca el número consecutivo
            </p>
          </div>

          <div>
            <Label htmlFor="nextFolioNumber" className="text-black">Próximo Número de Folio</Label>
            <Input
              id="nextFolioNumber"
              type="number"
              value={localSettings.nextServiceFolioNumber}
              onChange={(e) => handleInputChange('nextServiceFolioNumber', parseInt(e.target.value))}
              placeholder="1000"
              className="bg-white border-gray-300 text-black"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-black text-lg sm:text-xl">Logotipo de la Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogo={localSettings.logo}
            onLogoChange={handleLogoChange}
            disabled={isLogoUpdating}
            labelClassName="text-black"
          />
        </CardContent>
      </Card>

      <Card className="bg-card border">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-black text-lg sm:text-xl">Empresas adicionales (encabezado y logotipo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-black">Seleccionar empresa</Label>
              <Select value={selectedProfileRut} onValueChange={setSelectedProfileRut}>
                <SelectTrigger className="bg-white border-gray-300 text-black">
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
              <Label className="text-black">RUT</Label>
              <Input
                value={profileForm.rut}
                onChange={(e) => setProfileForm(prev => ({ ...prev, rut: formatRut(e.target.value) }))}
                placeholder="13.222.170-7"
                className="bg-white border-gray-300 text-black"
                disabled={selectedProfileRut !== '__new__'}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-black">Nombre</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="LowBoy Chile SpA"
                className="bg-white border-gray-300 text-black"
              />
            </div>
          </div>

          <div>
            <Label className="text-black">Dirección</Label>
            <Textarea
              value={profileForm.address}
              onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Dirección completa"
              className="bg-white border-gray-300 text-black"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-black">Teléfono</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+56 9 ..."
                className="bg-white border-gray-300 text-black"
              />
            </div>
            <div>
              <Label className="text-black">Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@..."
                className="bg-white border-gray-300 text-black"
              />
            </div>
          </div>

          <div className="rounded-md border p-4">
            <LogoUpload
              currentLogo={profileForm.logoUrl}
              onLogoChange={handleProfileLogoChange}
              disabled={updatingProfileLogo}
              labelClassName="text-black"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={saveCompanyProfile} disabled={savingProfile} className="bg-tms-green hover:bg-tms-green/90 text-black">
              {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Empresa
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green/90 text-black"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
