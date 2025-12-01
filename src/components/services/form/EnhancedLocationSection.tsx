import React from 'react';
import { Label } from '@/components/ui/label';
import { LocationCombobox } from './LocationCombobox';
import { AlertTriangle } from 'lucide-react';

interface EnhancedLocationSectionProps {
  origin: string;
  onOriginChange: (value: string) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
  originRequired?: boolean;
  destinationRequired?: boolean;
  disabled?: boolean;
  originError?: boolean;
  destinationError?: boolean;
}

export const EnhancedLocationSection = ({
  origin,
  onOriginChange,
  destination,
  onDestinationChange,
  originRequired = false,
  destinationRequired = false,
  disabled = false,
  originError = false,
  destinationError = false
}: EnhancedLocationSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin" className={originError ? 'text-destructive' : ''}>
          Origen {originRequired && <span className="text-red-500">*</span>}
          {!originRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
          {originError && (
            <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Requerido
            </span>
          )}
        </Label>
        <LocationCombobox
          value={origin}
          onValueChange={onOriginChange}
          placeholder="Dirección de origen del servicio"
          type="origin"
          disabled={disabled}
          className={originError ? 'border-destructive' : ''}
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination" className={destinationError ? 'text-destructive' : ''}>
          Destino {destinationRequired && <span className="text-red-500">*</span>}
          {!destinationRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
          {destinationError && (
            <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Requerido
            </span>
          )}
        </Label>
        <LocationCombobox
          value={destination}
          onValueChange={onDestinationChange}
          placeholder="Dirección de destino del servicio"
          type="destination"
          disabled={disabled}
          className={destinationError ? 'border-destructive' : ''}
        />
      </div>
    </div>
  );
};