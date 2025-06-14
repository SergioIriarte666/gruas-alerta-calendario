
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LogoUpload } from '@/components/settings/LogoUpload';
import { Building2, Save } from 'lucide-react';

interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logo?: string;
}

interface CompanySettingsTabProps {
  settings: CompanySettings;
  saving: boolean;
  onSave: () => void;
  onLogoChange: (logoFile: File | null) => void;
  onUpdateSettings: (updates: Partial<{ company: CompanySettings }>) => void;
}

export const CompanySettingsTab: React.FC<CompanySettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onLogoChange,
  onUpdateSettings
}) => {
  const handleInputChange = (field: keyof CompanySettings, value: string) => {
    onUpdateSettings({ company: { ...settings, [field]: value } });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Building2 className="w-5 h-5 text-tms-green" />
          <span>Información de la Empresa</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <LogoUpload
          currentLogo={settings.logo}
          onLogoChange={onLogoChange}
          disabled={saving}
        />
        
        <Separator className="bg-gray-700" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-gray-300">Nombre de la Empresa</Label>
            <Input
              id="company-name"
              value={settings.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email" className="text-gray-300">Email</Label>
            <Input
              id="company-email"
              type="email"
              value={settings.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-phone" className="text-gray-300">Teléfono</Label>
            <Input
              id="company-phone"
              value={settings.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-taxid" className="text-gray-300">RUT</Label>
            <Input
              id="company-taxid"
              value={settings.taxId}
              onChange={(e) => handleInputChange('taxId', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-address" className="text-gray-300">Dirección</Label>
          <Input
            id="company-address"
            value={settings.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="bg-white/5 border-gray-700 text-white"
          />
        </div>
        <Button 
          onClick={onSave}
          disabled={saving}
          className="bg-tms-green hover:bg-tms-green-dark text-white"
          title="Guardar los cambios en la información de la empresa"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </CardContent>
    </Card>
  );
};
