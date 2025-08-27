import React from 'react';
import { Label } from '@/components/ui/label';
import { LocationCombobox } from './LocationCombobox';

interface EnhancedLocationSectionProps {
  origin: string;
  onOriginChange: (value: string) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
  originRequired?: boolean;
  destinationRequired?: boolean;
  disabled?: boolean;
}

export const EnhancedLocationSection = ({
  origin,
  onOriginChange,
  destination,
  onDestinationChange,
  originRequired = false,
  destinationRequired = false,
  disabled = false
}: EnhancedLocationSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin">
          Origen {originRequired && <span className="text-red-500">*</span>}
          {!originRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
        </Label>
        <LocationCombobox
          value={origin}
          onValueChange={onOriginChange}
          placeholder="Dirección de origen del servicio"
          type="origin"
          disabled={disabled}
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination">
          Destino {destinationRequired && <span className="text-red-500">*</span>}
          {!destinationRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
        </Label>
        <LocationCombobox
          value={destination}
          onValueChange={onDestinationChange}
          placeholder="Dirección de destino del servicio"
          type="destination"
          disabled={disabled}
        />
      </div>
    </div>
  );
};