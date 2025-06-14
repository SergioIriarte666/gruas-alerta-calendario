
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LocationSectionProps {
  origin: string;
  onOriginChange: (value: string) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
}

export const LocationSection = ({
  origin,
  onOriginChange,
  destination,
  onDestinationChange
}: LocationSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin">Origen</Label>
        <Input
          id="origin"
          value={origin}
          onChange={(e) => onOriginChange(e.target.value)}
          placeholder="Dirección de origen del servicio"
          required
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination">Destino</Label>
        <Input
          id="destination"
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          placeholder="Dirección de destino del servicio"
          required
        />
      </div>
    </div>
  );
};
