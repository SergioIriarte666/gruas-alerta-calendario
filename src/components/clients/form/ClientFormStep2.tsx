import React from 'react';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Mail, MapPin, User, Phone } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';

interface ClientFormStep2Props {
  phone: string;
  email: string;
  address: string;
  contactName: string;
  onChange: (field: string, value: string) => void;
}

export const ClientFormStep2 = ({ 
  phone, 
  email, 
  address, 
  contactName,
  onChange 
}: ClientFormStep2Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Información de Contacto"
        icon={<Phone className="size-5" />}
        color="blue"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
              <Phone className="size-4" />
              Teléfono
            </Label>
            <PhoneInput
              id="phone"
              value={phone ?? ''}
              onChange={(v) => onChange('phone', v)}
              placeholder="9 XXXX XXXX"
              className="bg-background"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground flex items-center gap-2">
              <Mail className="size-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="correo@ejemplo.com"
              className="bg-background"
            />
          </div>
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Ubicación y Contacto"
        icon={<MapPin className="size-5" />}
        color="cyan"
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-foreground flex items-center gap-2">
              <MapPin className="size-4" />
              Dirección
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => onChange('address', e.target.value)}
              onBlur={() => onChange('address', toTitleCase(address))}
              placeholder="Ingrese la dirección completa"
              className="bg-background"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contactName" className="text-foreground flex items-center gap-2">
              <User className="size-4" />
              Nombre del Contacto
            </Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => onChange('contactName', e.target.value)}
              onBlur={() => onChange('contactName', toTitleCase(contactName))}
              placeholder="Nombre de la persona de contacto"
              className="bg-background"
            />
          </div>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
