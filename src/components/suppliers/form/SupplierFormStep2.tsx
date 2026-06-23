import React from 'react';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Phone, Mail, MapPin, User } from 'lucide-react';

interface SupplierFormStep2Props {
  email: string;
  phone: string;
  address: string;
  contactName: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onContactNameChange: (value: string) => void;
  errors: {
    email?: string;
    phone?: string;
    address?: string;
    contact_name?: string;
  };
}

export const SupplierFormStep2 = ({ 
  email, 
  phone, 
  address, 
  contactName,
  onEmailChange,
  onPhoneChange,
  onAddressChange,
  onContactNameChange,
  errors 
}: SupplierFormStep2Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Información de Contacto"
        icon={<Phone className="size-5" />}
        color="blue"
        hasError={!!errors.phone || !!errors.email}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
              <Phone className="size-4" />
              Teléfono *
            </Label>
            <PhoneInput
              id="phone"
              value={phone ?? ''}
              onChange={(v) => onPhoneChange(v)}
              placeholder="9 XXXX XXXX"
              className="bg-background"
            />
            {errors.phone && (
              <p className="text-destructive text-sm">{errors.phone}</p>
            )}
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
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="email@ejemplo.com"
              className="bg-background"
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email}</p>
            )}
          </div>
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Ubicación y Contacto"
        icon={<MapPin className="size-5" />}
        color="cyan"
        hasError={!!errors.address || !!errors.contact_name}
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-foreground flex items-center gap-2">
              <MapPin className="size-4" />
              Dirección *
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Dirección completa"
              className="bg-background"
            />
            {errors.address && (
              <p className="text-destructive text-sm">{errors.address}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact_name" className="text-foreground flex items-center gap-2">
              <User className="size-4" />
              Persona de Contacto *
            </Label>
            <Input
              id="contact_name"
              value={contactName}
              onChange={(e) => onContactNameChange(e.target.value)}
              placeholder="Nombre del contacto principal"
              className="bg-background"
            />
            {errors.contact_name && (
              <p className="text-destructive text-sm">{errors.contact_name}</p>
            )}
          </div>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
