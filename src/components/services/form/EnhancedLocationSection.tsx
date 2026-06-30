import React from 'react';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete';
import { useFrequentLocations } from '@/hooks/services/useFrequentLocations';

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
  destinationError = false,
}: EnhancedLocationSectionProps) => {
  const { frequentOrigins, frequentDestinations } = useFrequentLocations();

  return (
    <div className="space-y-6">
      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin" className={originError ? 'text-destructive' : ''}>
          Origen {originRequired && <span className="text-red-500">*</span>}
          {!originRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
          {originError && (
            <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Requerido
            </span>
          )}
        </Label>
        <AddressAutocomplete
          id="origin"
          value={origin}
          onChange={onOriginChange}
          placeholder="Dirección de origen del servicio"
          disabled={disabled}
          error={originError}
          historySuggestions={frequentOrigins.map((l) => l.location)}
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination" className={destinationError ? 'text-destructive' : ''}>
          Destino {destinationRequired && <span className="text-red-500">*</span>}
          {!destinationRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
          {destinationError && (
            <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Requerido
            </span>
          )}
        </Label>
        <AddressAutocomplete
          id="destination"
          value={destination}
          onChange={onDestinationChange}
          placeholder="Dirección de destino del servicio"
          disabled={disabled}
          error={destinationError}
          historySuggestions={frequentDestinations.map((l) => l.location)}
        />
      </div>
    </div>
  );
};
