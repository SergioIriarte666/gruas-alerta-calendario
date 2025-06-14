
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface VehicleSectionProps {
  vehicleBrand: string;
  onVehicleBrandChange: (value: string) => void;
  vehicleModel: string;
  onVehicleModelChange: (value: string) => void;
  licensePlate: string;
  onLicensePlateChange: (value: string) => void;
}

export const VehicleSection = ({
  vehicleBrand,
  onVehicleBrandChange,
  vehicleModel,
  onVehicleModelChange,
  licensePlate,
  onLicensePlateChange
}: VehicleSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Marca del Vehículo */}
      <div className="space-y-2">
        <Label htmlFor="vehicleBrand">Marca del Vehículo</Label>
        <Input
          id="vehicleBrand"
          value={vehicleBrand}
          onChange={(e) => onVehicleBrandChange(e.target.value)}
          placeholder="Ej: Volvo"
          required
        />
      </div>

      {/* Modelo del Vehículo */}
      <div className="space-y-2">
        <Label htmlFor="vehicleModel">Modelo del Vehículo</Label>
        <Input
          id="vehicleModel"
          value={vehicleModel}
          onChange={(e) => onVehicleModelChange(e.target.value)}
          placeholder="Ej: FH16"
          required
        />
      </div>

      {/* Patente */}
      <div className="space-y-2">
        <Label htmlFor="licensePlate">Patente</Label>
        <Input
          id="licensePlate"
          value={licensePlate}
          onChange={(e) => onLicensePlateChange(e.target.value.toUpperCase())}
          placeholder="Ej: AB-CD-12"
          required
        />
      </div>
    </div>
  );
};
