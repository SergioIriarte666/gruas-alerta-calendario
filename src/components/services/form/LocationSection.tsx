
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LocationSectionProps {
  origin: string;
  onOriginChange: (value: string) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
  originRequired?: boolean;
  destinationRequired?: boolean;
  disabled?: boolean;
}

export const LocationSection = ({
  origin,
  onOriginChange,
  destination,
  onDestinationChange,
  originRequired = false,
  destinationRequired = false,
  disabled = false
}: LocationSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin">
          Origen {originRequired && <span className="text-danger-text">*</span>}
          {!originRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
        </Label>
        <Input
          id="origin"
          value={origin}
          onChange={(e) => onOriginChange(e.target.value)}
          placeholder="Dirección de origen del servicio"
          required={originRequired}
          disabled={disabled}
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination">
          Destino {destinationRequired && <span className="text-danger-text">*</span>}
          {!destinationRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
        </Label>
        <Input
          id="destination"
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          placeholder="Dirección de destino del servicio"
          required={destinationRequired}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
