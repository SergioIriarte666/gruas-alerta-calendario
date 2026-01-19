import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVehicleBrands } from '@/hooks/useVehicleBrands';
import { useVehicleModels } from '@/hooks/useVehicleModels';
import { useVehicleHistory } from '@/hooks/useVehicleHistory';
import { AlertTriangle, Plus, AlertCircle, Calendar, MapPin, User, FileText, Car } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  vehicleBrandError?: boolean;
  vehicleModelError?: boolean;
  licensePlateError?: boolean;
  isEditing?: boolean;
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
  disabled = false,
  vehicleBrandError = false,
  vehicleModelError = false,
  licensePlateError = false,
  isEditing = false
}: VehicleSectionProps) => {
  const { brands, loading: brandsLoading, createBrandAsync, isCreating: isCreatingBrand } = useVehicleBrands();
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const { models, loading: modelsLoading, createModelAsync, isCreating: isCreatingModel } = useVehicleModels(selectedBrandId);

  // Dialog states for new brand/model
  const [isNewBrandDialogOpen, setIsNewBrandDialogOpen] = useState(false);
  const [isNewModelDialogOpen, setIsNewModelDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newModelName, setNewModelName] = useState('');

  // License plate history validation states
  const [debouncedPlate, setDebouncedPlate] = useState('');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyConfirmed, setHistoryConfirmed] = useState(false);
  const confirmedPlatesRef = useRef<Set<string>>(new Set());
  
  // Fetch vehicle history for the debounced plate
  const { history, isLoading: historyLoading } = useVehicleHistory(
    debouncedPlate.length >= 4 ? debouncedPlate : ''
  );

  // Debounce license plate input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (licensePlate.length >= 4) {
        setDebouncedPlate(licensePlate.toUpperCase());
      } else {
        setDebouncedPlate('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [licensePlate]);

  // Show history dialog when plate has services (only for new services)
  useEffect(() => {
    if (
      !isEditing &&
      history &&
      history.length > 0 &&
      debouncedPlate === licensePlate.toUpperCase() &&
      !historyConfirmed &&
      !confirmedPlatesRef.current.has(debouncedPlate)
    ) {
      setShowHistoryDialog(true);
    }
  }, [history, debouncedPlate, licensePlate, isEditing, historyConfirmed]);

  // Reset confirmation when plate changes
  useEffect(() => {
    if (licensePlate.toUpperCase() !== debouncedPlate) {
      setHistoryConfirmed(false);
    }
  }, [licensePlate, debouncedPlate]);

  // Find brand ID from brand name when component loads
  useEffect(() => {
    if (vehicleBrand && brands.length > 0) {
      const brand = brands.find(b => b.name && b.name.toLowerCase() === vehicleBrand.toLowerCase());
      if (brand) {
        setSelectedBrandId(brand.id);
      }
    }
  }, [vehicleBrand, brands]);

  const handleConfirmContinue = () => {
    setHistoryConfirmed(true);
    confirmedPlatesRef.current.add(debouncedPlate);
    setShowHistoryDialog(false);
  };

  const handleCancelHistory = () => {
    setShowHistoryDialog(false);
    onLicensePlateChange('');
    setHistoryConfirmed(false);
  };

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

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return;
    
    try {
      const newBrand = await createBrandAsync({ name: newBrandName.trim() });
      if (newBrand) {
        setSelectedBrandId(newBrand.id);
        onVehicleBrandChange(newBrand.name);
        onVehicleModelChange('');
        setNewBrandName('');
        setIsNewBrandDialogOpen(false);
      }
    } catch (error) {
      console.error('Error creating brand:', error);
    }
  };

  const handleCreateModel = async () => {
    if (!newModelName.trim() || !selectedBrandId) return;
    
    try {
      const newModel = await createModelAsync({ 
        name: newModelName.trim(), 
        brand_id: selectedBrandId 
      });
      if (newModel) {
        onVehicleModelChange(newModel.name);
        setNewModelName('');
        setIsNewModelDialogOpen(false);
      }
    } catch (error) {
      console.error('Error creating model:', error);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Marca del Vehículo */}
        <div className="space-y-2">
          <Label htmlFor="vehicleBrand" className={vehicleBrandError ? 'text-destructive' : ''}>
            Marca del Vehículo {vehicleBrandRequired && <span className="text-red-500">*</span>}
            {vehicleBrandError && (
              <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Requerido
              </span>
            )}
          </Label>
          {!vehicleBrandRequired && !vehicleBrandError && (
            <p className="text-xs text-gray-400">Opcional para este tipo de servicio</p>
          )}
          <Select 
            value={selectedBrandId} 
            onValueChange={handleBrandChange}
            disabled={disabled || brandsLoading}
          >
            <SelectTrigger className={vehicleBrandError ? 'border-destructive' : ''}>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
            onClick={() => setIsNewBrandDialogOpen(true)}
            disabled={disabled}
          >
            <Plus className="h-3 w-3 mr-1" />
            Nueva marca
          </Button>
        </div>

        {/* Modelo del Vehículo */}
        <div className="space-y-2">
          <Label htmlFor="vehicleModel" className={vehicleModelError ? 'text-destructive' : ''}>
            Modelo del Vehículo {vehicleModelRequired && <span className="text-red-500">*</span>}
            {vehicleModelError && (
              <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Requerido
              </span>
            )}
          </Label>
          {!vehicleModelRequired && !vehicleModelError && (
            <p className="text-xs text-gray-400">Opcional para este tipo de servicio</p>
          )}
          <Select 
            value={vehicleModel ? models.find(m => m.name.toLowerCase() === vehicleModel.toLowerCase())?.id || '' : ''}
            onValueChange={handleModelChange}
            disabled={disabled || !selectedBrandId || modelsLoading}
          >
            <SelectTrigger className={vehicleModelError ? 'border-destructive' : ''}>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
            onClick={() => setIsNewModelDialogOpen(true)}
            disabled={disabled || !selectedBrandId}
          >
            <Plus className="h-3 w-3 mr-1" />
            Nuevo modelo
          </Button>
        </div>

        {/* Patente */}
        <div className="space-y-2">
          <Label htmlFor="licensePlate" className={licensePlateError ? 'text-destructive' : ''}>
            Patente {licensePlateRequired && <span className="text-red-500">*</span>}
            {licensePlateError && (
              <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Requerido
              </span>
            )}
          </Label>
          {!licensePlateRequired && !licensePlateError && (
            <p className="text-xs text-gray-400">Opcional para este tipo de servicio</p>
          )}
          <Input
            id="licensePlate"
            value={licensePlate}
            onChange={(e) => onLicensePlateChange(e.target.value.toUpperCase())}
            placeholder="Ej: AB-CD-12"
            required={licensePlateRequired}
            disabled={disabled}
            className={licensePlateError ? 'border-destructive' : ''}
          />
        </div>
      </div>

      {/* Dialog para crear nueva marca */}
      <Dialog open={isNewBrandDialogOpen} onOpenChange={setIsNewBrandDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Marca de Vehículo</DialogTitle>
            <DialogDescription>
              Agrega una nueva marca que no esté en el sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-brand-name">Nombre de la Marca</Label>
              <Input
                id="new-brand-name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Ej: Toyota, Ford, Chevrolet..."
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBrand()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setNewBrandName('');
                  setIsNewBrandDialogOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button 
                type="button"
                onClick={handleCreateBrand} 
                disabled={!newBrandName.trim() || isCreatingBrand}
              >
                {isCreatingBrand ? 'Creando...' : 'Crear Marca'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear nuevo modelo */}
      <Dialog open={isNewModelDialogOpen} onOpenChange={setIsNewModelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Modelo de Vehículo</DialogTitle>
            <DialogDescription>
              Agrega un nuevo modelo para la marca "{vehicleBrand}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-model-name">Nombre del Modelo</Label>
              <Input
                id="new-model-name"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="Ej: Corolla, Hilux, Ranger..."
                onKeyDown={(e) => e.key === 'Enter' && handleCreateModel()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setNewModelName('');
                  setIsNewModelDialogOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button 
                type="button"
                onClick={handleCreateModel} 
                disabled={!newModelName.trim() || isCreatingModel}
              >
                {isCreatingModel ? 'Creando...' : 'Crear Modelo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de historial del vehículo */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Vehículo con Historial
            </DialogTitle>
            <DialogDescription>
              El vehículo <span className="font-semibold">{licensePlate}</span> ya tiene servicios registrados en el sistema.
            </DialogDescription>
          </DialogHeader>
          
          {history && history.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Último servicio registrado:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(history[0].serviceDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">Origen:</span>
                  <span>{history[0].origin || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span className="text-muted-foreground">Destino:</span>
                  <span>{history[0].destination || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span>{history[0].client?.name || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Folio:</span>
                  <span className="font-mono">{history[0].folio}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{history[0].serviceType?.name || 'No especificado'}</span>
                </div>
              </div>
              
              {history.length > 1 && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Este vehículo tiene {history.length} servicios en total.
                </p>
              )}
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            ¿Desea continuar creando un nuevo servicio para este vehículo?
          </p>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleCancelHistory}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmContinue}>
              Sí, Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
