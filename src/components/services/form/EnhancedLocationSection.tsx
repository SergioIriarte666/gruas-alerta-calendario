import React, { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
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
  const originListId = useId();
  const destListId = useId();

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
        <Input
          id="origin"
          value={origin}
          onChange={(e) => onOriginChange(e.target.value)}
          placeholder="Dirección de origen del servicio"
          disabled={disabled}
          autoComplete="off"
          list={originListId}
        />
        <datalist id={originListId}>
          {frequentOrigins.map((l) => (
            <option key={l.location} value={l.location} />
          ))}
        </datalist>
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
        <Input
          id="destination"
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          placeholder="Dirección de destino del servicio"
          disabled={disabled}
          autoComplete="off"
          list={destListId}
        />
        <datalist id={destListId}>
          {frequentDestinations.map((l) => (
            <option key={l.location} value={l.location} />
          ))}
        </datalist>
      </div>
    </div>
  );
};
