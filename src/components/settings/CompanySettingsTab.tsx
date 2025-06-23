
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LogoUpload } from './LogoUpload';
import { useSettings } from '@/hooks/useSettings';
import { useLogoUpdater } from '@/hooks/useLogoUpdater';
import { useToast } from '@/components/ui/custom-toast';
import { useState, useEffect } from 'react';

export const CompanySettingsTab = () => {
  const { settings, updateSettings, saveSettings, saving, loading } = useSettings();
  const { uploadDefaultLogo, isUpdating: isLogoUpdating } = useLogoUpdater();
  const { toast } = useToast();
  const [localNextFolio, setLocalNextFolio] = useState('1000');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Update local folio when settings change
  useEffect(() => {
    if (settings?.company?.nextServiceFolioNumber) {
      setLocalNextFolio(settings.company.nextServiceFolioNumber.toString());
    }
  }, [settings?.company?.nextServiceFolioNumber]);

  // Initialize company data if empty
  useEffect(() => {
    if (settings && !hasInitialized && !settings.company.name) {
      console.log("🏢 Inicializando datos de empresa por defecto...");
      
      updateSettings({
        company: {
          name: 'TMS - Transport Management System',
          taxId: '12.345.678-9',
          address: 'Av. Principal 123, Santiago',
          phone: '+56 9 1234 5678',
          email: 'contacto@tms.cl',
          folioFormat: 'SRV-{number}',
          nextServiceFolioNumber: 1000
        }
      });
      
      setHasInitialized(true);
    }
  }, [settings, updateSettings, hasInitialized]);

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

  const handleLogoChange = async (file: File | null) => {
    console.log('Logo change requested:', file);
    // The logo will be handled by the parent Settings component
  };

  const handleUploadDefaultLogo = async () => {
    const result = await uploadDefaultLogo();
    if (result.success) {
      toast({
        type: "success",
        title: "Logo corporativo subido",
        description: "El logo predeterminado de TMS se ha configurado exitosamente.",
      });
      // Trigger settings refresh
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } else {
      toast({
        type: "error",
        title: "Error al subir logo",
        description: result.error || "No se pudo subir el logo predeterminado.",
      });
    }
  };

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">Cargando configuración de la empresa...</div>
      </div>
    );
  }

  // Ensure we have settings before rendering
  if (!settings || !settings.company) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">No se pudo cargar la configuración de la empresa.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Información de la Empresa</CardTitle>
          <CardDescription className="text-gray-400">
            Configura la información básica de tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name" className="text-gray-300">Nombre de la Empresa</Label>
              <Input
                id="company-name"
                value={settings.company.name || ''}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, name: e.target.value }
                })}
                placeholder="Nombre de tu empresa"
                className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-rut" className="text-gray-300">RUT</Label>
              <Input
                id="company-rut"
                value={settings.company.taxId || ''}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, taxId: e.target.value }
                })}
                placeholder="12.345.678-9"
                className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-address" className="text-gray-300">Dirección</Label>
            <Input
              id="company-address"
              value={settings.company.address || ''}
              onChange={(e) => updateSettings({
                company: { ...settings.company, address: e.target.value }
              })}
              placeholder="Dirección de la empresa"
              className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-phone" className="text-gray-300">Teléfono</Label>
              <Input
                id="company-phone"
                value={settings.company.phone || ''}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, phone: e.target.value }
                })}
                placeholder="+56 9 1234 5678"
                className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email" className="text-gray-300">Email</Label>
              <Input
                id="company-email"
                type="email"
                value={settings.company.email || ''}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, email: e.target.value }
                })}
                placeholder="contacto@empresa.cl"
                className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Configuración de Folios</CardTitle>
          <CardDescription className="text-gray-400">
            Configura el formato y numeración de los folios de servicios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="folio-format" className="text-gray-300">Formato de Folio</Label>
              <Input
                id="folio-format"
                value={settings.company.folioFormat || 'SRV-{number}'}
                onChange={(e) => updateSettings({
                  company: { ...settings.company, folioFormat: e.target.value }
                })}
                placeholder="SRV-{number}"
                className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
              />
              <p className="text-xs text-gray-500">
                Usa {'{number}'} donde quieras que aparezca el número correlativo
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-folio-number" className="text-gray-300">Próximo Número de Folio</Label>
              <Input
                id="next-folio-number"
                type="number"
                min="1000"
                value={localNextFolio}
                onChange={(e) => handleNextFolioChange(e.target.value)}
                placeholder="1000"
                className="bg-gray-700 border-gray-600 text-white focus:border-tms-green"
              />
              <p className="text-xs text-gray-500">
                El próximo folio automático será: {(settings.company.folioFormat || 'SRV-{number}').replace('{number}', String(settings.company.nextServiceFolioNumber || 1000).padStart(4, '0'))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Logo de la Empresa</CardTitle>
          <CardDescription className="text-gray-400">
            Sube el logo de tu empresa para usar en reportes y documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LogoUpload 
            currentLogo={settings.company.logo}
            onLogoChange={handleLogoChange}
            disabled={isLogoUpdating}
          />
          
          {!settings.company.logo && (
            <div className="text-center">
              <Button 
                onClick={handleUploadDefaultLogo}
                disabled={isLogoUpdating}
                variant="outline"
                className="border-tms-green text-tms-green hover:bg-tms-green hover:text-black"
              >
                {isLogoUpdating ? 'Subiendo...' : 'Usar Logo Corporativo TMS'}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Configura automáticamente el logo corporativo de TMS
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving || isLogoUpdating}
          className="bg-tms-green hover:bg-tms-green/80 text-black font-medium"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
};
