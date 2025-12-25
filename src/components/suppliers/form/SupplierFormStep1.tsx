import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Building2 } from 'lucide-react';

interface SupplierFormStep1Props {
  name: string;
  rut: string;
  onNameChange: (value: string) => void;
  onRutChange: (value: string) => void;
  errors: {
    name?: string;
    rut?: string;
  };
}

export const SupplierFormStep1 = ({ 
  name, 
  rut, 
  onNameChange, 
  onRutChange,
  errors 
}: SupplierFormStep1Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Datos Básicos"
        icon={<Building2 className="h-5 w-5" />}
        color="purple"
        required
        hasError={!!errors.name || !!errors.rut}
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Nombre del proveedor"
              className="bg-background"
            />
            {errors.name && (
              <p className="text-destructive text-sm">{errors.name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rut" className="text-foreground">RUT *</Label>
            <Input
              id="rut"
              value={rut}
              onChange={(e) => onRutChange(e.target.value)}
              placeholder="12.345.678-9"
              className="bg-background"
            />
            {errors.rut && (
              <p className="text-destructive text-sm">{errors.rut}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Formato: XX.XXX.XXX-X
            </p>
          </div>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
