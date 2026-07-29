import React from 'react';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { OriginLocationField, type OriginResolvedCoords } from '@/components/services/OriginLocationField';

interface EnhancedLocationSectionProps {
  origin: string;
  onOriginChange: (value: string) => void;
  originCoords: OriginResolvedCoords;
  onOriginCoordsChange: (coords: OriginResolvedCoords) => void;
  originDepartment?: string | null;
  canEditCatalog?: boolean;
  destination: string;
  onDestinationChange: (value: string) => void;
  destinationCoords: OriginResolvedCoords;
  onDestinationCoordsChange: (coords: OriginResolvedCoords) => void;
  originRequired?: boolean;
  destinationRequired?: boolean;
  disabled?: boolean;
  originError?: boolean;
  destinationError?: boolean;
}

export const EnhancedLocationSection = ({
  origin,
  onOriginChange,
  originCoords,
  onOriginCoordsChange,
  originDepartment,
  canEditCatalog = false,
  destination,
  onDestinationChange,
  destinationCoords,
  onDestinationCoordsChange,
  originRequired = false,
  destinationRequired = false,
  disabled = false,
  originError = false,
  destinationError = false,
}: EnhancedLocationSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin" className={originError ? 'text-destructive' : ''}>
          Origen {originRequired && <span className="text-danger-text">*</span>}
          {!originRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
          {originError && (
            <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle className="size-3" />
              {origin.trim() ? 'Ubicacion sin confirmar' : 'Requerido'}
            </span>
          )}
        </Label>
        <OriginLocationField
          id="origin"
          value={origin}
          onChange={onOriginChange}
          coords={originCoords}
          onCoordsChange={onOriginCoordsChange}
          department={originDepartment}
          canEditCatalog={canEditCatalog}
          placeholder="Direccion de origen del servicio"
          disabled={disabled}
          error={originError}
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination" className={destinationError ? 'text-destructive' : ''}>
          Destino {destinationRequired && <span className="text-danger-text">*</span>}
          {!destinationRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
          {destinationError && (
            <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
              <AlertTriangle className="size-3" />
              {destination.trim() ? 'Ubicacion sin confirmar' : 'Requerido'}
            </span>
          )}
        </Label>
        <OriginLocationField
          id="destination"
          value={destination}
          onChange={onDestinationChange}
          coords={destinationCoords}
          onCoordsChange={onDestinationCoordsChange}
          department={originDepartment}
          canEditCatalog={canEditCatalog}
          placeholder="Direccion o enlace de Google Maps del destino"
          disabled={disabled}
          error={destinationError}
        />
      </div>
    </div>
  );
};
