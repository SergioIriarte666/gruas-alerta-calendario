import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Building2 } from 'lucide-react';

interface ClientFormStep1Props {
  name: string;
  rut: string;
  onChange: (field: string, value: string) => void;
}

export const ClientFormStep1 = ({ name, rut, onChange }: ClientFormStep1Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Datos Básicos"
        icon={<Building2 className="h-5 w-5" />}
        color="purple"
        required
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Nombre/Razón Social *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="Ingrese el nombre o razón social"
              className="bg-background"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rut" className="text-foreground">RUT *</Label>
            <Input
              id="rut"
              value={rut}
              onChange={(e) => onChange('rut', e.target.value)}
              placeholder="12.345.678-9"
              className="bg-background"
              required
            />
            <p className="text-xs text-muted-foreground">
              Formato: XX.XXX.XXX-X
            </p>
          </div>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
