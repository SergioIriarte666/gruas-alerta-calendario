import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVehicleBrands } from '@/hooks/useVehicleBrands';
import { useVehicleModels } from '@/hooks/useVehicleModels';

interface VehicleSectionProps {
  vehicleBrand: string;
  onVehicleBrandChange: (value: string) => void;
  vehicleModel: string;
  onVehicleModelChange: (value: string) => void;
  licensePlate: string;
  onLicensePlateChange: (value: string) => void;
  vehicleBrandRequired?: boolean;
  vehicleModelRequired?: boolean;
  licensePlateRequired?: boolean;
  disabled?: boolean;
}

export const VehicleSection = ({
  vehicleBrand,
  onVehicleBrandChange,
  vehicleModel,
  onVehicleModelChange,
  licensePlate,
  onLicensePlateChange,
  vehicleBrandRequired = false,
  vehicleModelRequired = false,
  licensePlateRequired = false,
  disabled = false
}: VehicleSectionProps) => {
  const { brands, loading: brandsLoading, error: brandsError } = useVehicleBrands();
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const { models, loading: modelsLoading } = useVehicleModels(selectedBrandId);

  // Find brand ID from brand name when component loads
  useEffect(() => {
    if (vehicleBrand && brands.length > 0) {
      const brand = brands.find(b => b.name.toLowerCase() === vehicleBrand.toLowerCase());
      if (brand) {
        setSelectedBrandId(brand.id);
      }
    }
  }, [vehicleBrand, brands]);

  const handleBrandChange = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    if (brand) {
      setSelectedBrandId(brandId);
      onVehicleBrandChange(brand.name);
      // Reset model when brand changes
      onVehicleModelChange('');
    }
  };

  const handleModelChange = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      onVehicleModelChange(model.name);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Marca del Vehículo */}
      <div className="space-y-2">
        <Label htmlFor="vehicleBrand">
          Marca del Vehículo {vehicleBrandRequired && <span className="text-red-500">*</span>}
        </Label>
        {!vehicleBrandRequired && (
          <p className="text-xs text-gray-400">Opcional para este tipo de servicio</p>
        )}
        <Select 
          value={selectedBrandId} 
          onValueChange={handleBrandChange}
          disabled={disabled || brandsLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={brandsLoading ? "Cargando marcas..." : "Selecciona una marca"} />
          </SelectTrigger>
          <SelectContent>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Modelo del Vehículo */}
      <div className="space-y-2">
        <Label htmlFor="vehicleModel">
          Modelo del Vehículo {vehicleModelRequired && <span className="text-red-500">*</span>}
        </Label>
        {!vehicleModelRequired && (
          <p className="text-xs text-gray-400">Opcional para este tipo de servicio</p>
        )}
        <Select 
          value={models.find(m => m.name.toLowerCase() === vehicleModel.toLowerCase())?.id || ''}
          onValueChange={handleModelChange}
          disabled={disabled || !selectedBrandId || modelsLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={
              !selectedBrandId 
                ? "Primero selecciona una marca" 
                : modelsLoading 
                  ? "Cargando modelos..." 
                  : "Selecciona un modelo"
            } />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Patente */}
      <div className="space-y-2">
        <Label htmlFor="licensePlate">
          Patente {licensePlateRequired && <span className="text-red-500">*</span>}
        </Label>
        {!licensePlateRequired && (
          <p className="text-xs text-gray-400">Opcional para este tipo de servicio</p>
        )}
        <Input
          id="licensePlate"
          value={licensePlate}
          onChange={(e) => onLicensePlateChange(e.target.value.toUpperCase())}
          placeholder="Ej: AB-CD-12"
          required={licensePlateRequired}
          disabled={disabled}
        />
      </div>
    </div>
  );
};