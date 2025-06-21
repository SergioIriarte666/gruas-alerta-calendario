
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LogoUpload } from './LogoUpload';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/custom-toast';
import { useState } from 'react';

export const CompanySettingsTab = () => {
  const { settings, updateSettings, saveSettings, saving } = useSettings();
  const { toast } = useToast();
  const [localNextFolio, setLocalNextFolio] = useState(
    settings.company.nextServiceFolioNumber?.toString() || '1000'
  );

  const handleSave = async () => {
    const result = await saveSettings();
    if (result.success) {
      toast({
        type: "success",
        title: "Configuración guardada",
        description: "La configuración de la empresa se ha guardado correctamente.",
      });
    } else {
      toast({
        type: "error", 
        title: "Error al guardar",
        description: result.error || "No se pudo guardar la configuración.",
      });
    }
  };

  const handleNextFolioChange = (value: string) => {
    setLocalNextFolio(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 1000) {
      updateSettings({
        company: {
          ...settings.company,
          nextServiceFolioNumber: numValue
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Empresa</CardTitle>
          <CardDescription>
            Configura la información básica de tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nombre de la Empresa</Label>
              <Input
                id="company-name"
                value={settings.company.name}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, name: e.target.value }
                })}
                placeholder="Nombre de tu empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-rut">RUT</Label>
              <Input
                id="company-rut"
                value={settings.company.taxId}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, taxId: e.target.value }
                })}
                placeholder="12.345.678-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-address">Dirección</Label>
            <Input
              id="company-address"
              value={settings.company.address}
              onChange={(e) => updateSettings({
                company: { ...settings.company, address: e.target.value }
              })}
              placeholder="Dirección de la empresa"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-phone">Teléfono</Label>
              <Input
                id="company-phone"
                value={settings.company.phone}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, phone: e.target.value }
                })}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email</Label>
              <Input
                id="company-email"
                type="email"
                value={settings.company.email}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, email: e.target.value }
                })}
                placeholder="contacto@empresa.cl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Folios</CardTitle>
          <CardDescription>
            Configura el formato y numeración de los folios de servicios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="folio-format">Formato de Folio</Label>
              <Input
                id="folio-format"
                value={settings.company.folioFormat}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, folioFormat: e.target.value }
                })}
                placeholder="SRV-{number}"
              />
              <p className="text-xs text-gray-500">
                Usa {'{number}'} donde quieras que aparezca el número correlativo
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-folio-number">Próximo Número de Folio</Label>
              <Input
                id="next-folio-number"
                type="number"
                min="1000"
                value={localNextFolio}
                onChange={(e) => handleNextFolioChange(e.target.value)}
                placeholder="1000"
              />
              <p className="text-xs text-gray-500">
                El próximo folio automático será: {settings.company.folioFormat.replace('{number}', String(settings.company.nextServiceFolioNumber || 1000).padStart(4, '0'))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo de la Empresa</CardTitle>
          <CardDescription>
            Sube el logo de tu empresa para usar en reportes y documentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
};
