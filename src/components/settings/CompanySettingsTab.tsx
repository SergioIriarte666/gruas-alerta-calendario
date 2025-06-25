
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

export const CompanySettingsTab = () => {
  const { settings, updateSettings, saveSettings, saving } = useSettings();
  const { isUpdating: isLogoUpdating, updateLogo } = useLogoUpdater();
  const [localSettings, setLocalSettings] = useState(settings.company);

  React.useEffect(() => {
    setLocalSettings(settings.company);
  }, [settings.company]);

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

  return (
    <div className="space-y-6">
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-black">Información de la Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <CardTitle className="text-black">Logotipo de la Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogo={localSettings.logo}
            onLogoChange={handleLogoChange}
            isUpdating={isLogoUpdating}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green/90 text-white"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
};
