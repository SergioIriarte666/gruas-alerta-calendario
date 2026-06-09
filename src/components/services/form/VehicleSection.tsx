import { useEffect, useState, useRef } from 'react';
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
import { usePatentLookup } from '@/hooks/usePatentLookup';
import { AlertTriangle, Plus, AlertCircle, Calendar, MapPin, User, FileText, Car, Clock, Loader2, Lightbulb, CheckCircle2, ShieldAlert, Info } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseFromDatabase, getBusinessTodayDate } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isChileanPlate, isVIN } from '@/utils/vehicleIdentifiers';
import { createLogger } from "@/lib/logger";


const logger = createLogger("VehicleSection");
// --- Normalization utilities ---
const normalizeText = (text: string): string =>
  text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const tokenize = (text: string): string[] =>
  normalizeText(text).split(/[\s\-_/]+/).filter(t => t.length > 0);

const brandMatches = (a: string, b: string): boolean =>
  normalizeText(a) === normalizeText(b);

const modelMatches = (entered: string, official: string): boolean => {
  const ne = normalizeText(entered);
  const no = normalizeText(official);
  if (ne === no) return true;
  // Token-based: all tokens of entered must appear in official (allows suffix like VD01)
  const enteredTokens = tokenize(entered);
  const officialTokens = tokenize(official);
  if (enteredTokens.length >= 2 && enteredTokens.every(t => officialTokens.includes(t))) return true;
  if (officialTokens.length >= 2 && officialTokens.every(t => enteredTokens.includes(t))) return true;
  // Contains check
  if (no.includes(ne) || ne.includes(no)) return true;
  return false;
};

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
  skipLookup?: boolean;
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
  isEditing = false,
  skipLookup = false,
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

  // Patent lookup suggestion states
  const { data: patentData, dataPlate, loading: patentLoading, lookupPatent, lookupVin, vinData, stolenAlerts, reset: resetPatent } = usePatentLookup();
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState(false);
  const [suggestionStep, setSuggestionStep] = useState<'preview' | 'confirm'>('preview');
  const [editBrandName, setEditBrandName] = useState('');
  const [editModelName, setEditModelName] = useState('');
  const [brandExistsFlag, setBrandExistsFlag] = useState(false);
  const [modelExistsFlag, setModelExistsFlag] = useState(false);
  const appliedPlatesRef = useRef<Set<string>>(new Set());
  const searchedPlatesRef = useRef<Set<string>>(new Set()); // Track plates we've already searched
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  
  // Cross-verification states
  const [mismatchWarning, setMismatchWarning] = useState<{
    expectedBrand: string;
    expectedModel: string;
    enteredBrand: string;
    enteredModel: string;
  } | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const prevPlateRef = useRef<string>('');
  
  // Fetch vehicle history for the debounced plate
  const { history } = useVehicleHistory(
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

  // Patent / VIN lookup when plate changes (debounced, 800ms)
  // Priority: 1) skipLookup → nothing  2) VIN → decode  3) local history → autocomplete  4) API cache  5) API call
  useEffect(() => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();

    if (skipLookup || cleanPlate.length < 6) return;

    // VIN path: decode only, no brand/model lookup
    if (isVIN(cleanPlate)) {
      if (searchedPlatesRef.current.has(cleanPlate) || isEditing) return;
      const timer = setTimeout(() => {
        searchedPlatesRef.current.add(cleanPlate);
        lookupVin(cleanPlate);
      }, 800);
      return () => clearTimeout(timer);
    }

    // Chilean plate path
    if (
      !isChileanPlate(cleanPlate) ||
      searchedPlatesRef.current.has(cleanPlate) ||
      appliedPlatesRef.current.has(cleanPlate) ||
      isEditing ||
      patentLoading
    ) return;

    const timer = setTimeout(() => {
      // 1. Search local service history first (free, instant)
      const localMatch = history?.[0]; // already filtered by license_plate in query

      if (localMatch?.vehicleBrand) {
        logger.debug(`[PatentLookup] Local data for ${cleanPlate}: ${localMatch.vehicleBrand}`);
        searchedPlatesRef.current.add(cleanPlate);
        if (!vehicleBrand) {
          onVehicleBrandChange(localMatch.vehicleBrand);
          if (localMatch.vehicleModel) {
            onVehicleModelChange(localMatch.vehicleModel);
          }
          appliedPlatesRef.current.add(cleanPlate);
          toast.success('Datos del vehículo completados desde historial');
        }
      } else {
        // 2. No local data → call API (handles its own 24h cache via patent_search_history)
        logger.debug(`[PatentLookup] No local data for ${cleanPlate}, calling API`);
        searchedPlatesRef.current.add(cleanPlate);
        lookupPatent(cleanPlate);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [licensePlate, isEditing, patentLoading, skipLookup, history]);

  // Show suggestion dialog when patent data arrives and NO brand selected
  useEffect(() => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    if (
      patentData &&
      patentData.marca !== 'No disponible' &&
      !appliedPlatesRef.current.has(cleanPlate) &&
      !showSuggestionDialog &&
      !vehicleBrand &&
      !isEditing
    ) {
      setShowSuggestionDialog(true);
    }
  }, [patentData, licensePlate, vehicleBrand, isEditing, showSuggestionDialog]);

  // Cross-verify when patent data exists AND brand/model are already filled
  useEffect(() => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    // Only validate if dataPlate matches current plate
    if (
      patentData &&
      patentData.marca !== 'No disponible' &&
      dataPlate === cleanPlate &&
      vehicleBrand &&
      cleanPlate.length >= 6 &&
      !isEditing &&
      !warningDismissed
    ) {
      const bMatch = brandMatches(vehicleBrand, patentData.marca);
      const mMatch = !vehicleModel || modelMatches(vehicleModel, patentData.modelo);

      if (bMatch && mMatch) {
        setMismatchWarning(null);
        setVerificationSuccess(true);
      } else {
        setVerificationSuccess(false);
        setMismatchWarning({
          expectedBrand: patentData.marca,
          expectedModel: patentData.modelo,
          enteredBrand: vehicleBrand,
          enteredModel: vehicleModel || '(sin modelo)',
        });
      }
    }
  }, [patentData, dataPlate, vehicleBrand, vehicleModel, licensePlate, isEditing, warningDismissed]);

  // Handle pending model after brand is set
  useEffect(() => {
    const applyPendingModel = async () => {
      if (pendingModel && selectedBrandId && models.length > 0 && !modelsLoading) {
        // Find existing model
        const existingModel = models.find(
          m => m.name.toLowerCase() === pendingModel.toLowerCase()
        );

        if (existingModel) {
          onVehicleModelChange(existingModel.name);
        } else if (pendingModel !== 'No disponible') {
          // Create new model
          try {
            const newModel = await createModelAsync({
              name: pendingModel,
              brand_id: selectedBrandId,
            });
            if (newModel) {
              onVehicleModelChange(newModel.name);
            }
          } catch (error) {
            logger.error('Error creating model from suggestion:', error);
          }
        }
        setPendingModel(null);
      }
    };

    applyPendingModel();
  }, [pendingModel, selectedBrandId, models, modelsLoading, onVehicleModelChange, createModelAsync]);

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

  // Reset confirmation and mismatch warning when plate/brand/model changes
  useEffect(() => {
    if (licensePlate.toUpperCase() !== debouncedPlate) {
      setHistoryConfirmed(false);
    }
  }, [licensePlate, debouncedPlate]);

  // Clear verification status when plate changes — reset everything stale
  useEffect(() => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    if (prevPlateRef.current && prevPlateRef.current !== cleanPlate) {
      setMismatchWarning(null);
      setVerificationSuccess(false);
      setWarningDismissed(false);
      resetPatent();
      // Allow re-searching this plate
      searchedPlatesRef.current.delete(prevPlateRef.current);
    }
    prevPlateRef.current = cleanPlate;
  }, [licensePlate]);

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
      logger.error('Error creating brand:', error);
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
      logger.error('Error creating model:', error);
    }
  };

  const handleApplySuggestion = async () => {
    if (!patentData) return;
    
    // Check if brand exists
    const existingBrand = brands.find(
      b => b.name.toLowerCase() === patentData.marca.toLowerCase()
    );
    
    // Check if model exists via direct DB query (works regardless of selected brand)
    let existingModel = false;
    let existingModelName = '';
    if (existingBrand && patentData.modelo !== 'No disponible') {
      const { data: modelData } = await supabase
        .from('vehicle_models')
        .select('id, name')
        .eq('brand_id', existingBrand.id)
        .eq('is_active', true)
        .ilike('name', patentData.modelo)
        .maybeSingle();
      
      existingModel = !!modelData;
      if (modelData) {
        existingModelName = modelData.name; // nombre con casing correcto de la BD
      }
    }
    
    const brandOk = !!existingBrand;
    const modelOk = existingModel || patentData.modelo === 'No disponible';
    
    if (brandOk && modelOk) {
      // Both exist, apply directly using DB names (correct casing)
      await applyExistingSuggestion(existingBrand.id, existingBrand.name, existingModelName || patentData.modelo);
    } else {
      // Show confirmation step - use DB names when available
      setBrandExistsFlag(brandOk);
      setModelExistsFlag(modelOk);
      setEditBrandName(existingBrand ? existingBrand.name : patentData.marca);
      setEditModelName(existingModel ? existingModelName : patentData.modelo);
      setSuggestionStep('confirm');
    }
  };

  const applyExistingSuggestion = async (brandId: string, brandName: string, modelName: string) => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    setIsApplyingSuggestion(true);
    try {
      setSelectedBrandId(brandId);
      onVehicleBrandChange(brandName);
      if (modelName && modelName !== 'No disponible') {
        setPendingModel(modelName);
      }
      appliedPlatesRef.current.add(cleanPlate);
      setShowSuggestionDialog(false);
      setSuggestionStep('preview');
      toast.success('Datos del vehículo aplicados');
    } catch (error) {
      logger.error('Error applying suggestion:', error);
      toast.error('Error al aplicar sugerencia');
    } finally {
      setIsApplyingSuggestion(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!patentData) return;
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    setIsApplyingSuggestion(true);
    
    try {
      let brandId: string;
      
      if (brandExistsFlag) {
        // Brand exists, just find it and use its DB name
        const existing = brands.find(b => b.name.toLowerCase() === patentData.marca.toLowerCase());
        brandId = existing!.id;
        setSelectedBrandId(brandId);
        onVehicleBrandChange(existing!.name);
      } else {
        // Create brand with edited name
        const newBrand = await createBrandAsync({ name: editBrandName.trim() });
        brandId = newBrand.id;
        setSelectedBrandId(brandId);
        onVehicleBrandChange(editBrandName.trim());
      }
      
      if (editModelName.trim() && editModelName !== 'No disponible') {
        setPendingModel(editModelName.trim());
      }
      
      appliedPlatesRef.current.add(cleanPlate);
      setShowSuggestionDialog(false);
      setSuggestionStep('preview');
      toast.success('Datos del vehículo aplicados');
    } catch (error) {
      logger.error('Error creating brand/model:', error);
      toast.error('Error al crear marca/modelo');
    } finally {
      setIsApplyingSuggestion(false);
    }
  };

  const handleIgnoreSuggestion = () => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    appliedPlatesRef.current.add(cleanPlate);
    setShowSuggestionDialog(false);
    setSuggestionStep('preview');
    resetPatent();
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
                <AlertTriangle className="size-3" />
                Requerido
              </span>
            )}
          </Label>
          {!vehicleBrandRequired && !vehicleBrandError && (
            <p className="text-xs text-muted-foreground">Opcional para este tipo de servicio</p>
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
            <Plus className="size-3 mr-1" />
            Nueva marca
          </Button>
        </div>

        {/* Modelo del Vehículo */}
        <div className="space-y-2">
          <Label htmlFor="vehicleModel" className={vehicleModelError ? 'text-destructive' : ''}>
            Modelo del Vehículo {vehicleModelRequired && <span className="text-red-500">*</span>}
            {vehicleModelError && (
              <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Requerido
              </span>
            )}
          </Label>
          {!vehicleModelRequired && !vehicleModelError && (
            <p className="text-xs text-muted-foreground">Opcional para este tipo de servicio</p>
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
            <Plus className="size-3 mr-1" />
            Nuevo modelo
          </Button>
        </div>

        {/* Patente */}
        <div className="space-y-2">
          <Label htmlFor="licensePlate" className={licensePlateError ? 'text-destructive' : ''}>
            Patente {licensePlateRequired && <span className="text-red-500">*</span>}
            {licensePlateError && (
              <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded inline-flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Requerido
              </span>
            )}
          </Label>
          {!licensePlateRequired && !licensePlateError && (
            <p className="text-xs text-muted-foreground">Opcional para este tipo de servicio</p>
          )}
          <div className="relative">
            <Input
              id="licensePlate"
              value={licensePlate}
              onChange={(e) => onLicensePlateChange(e.target.value.toUpperCase())}
              placeholder="Ej: AB-CD-12 o VIN"
              required={licensePlateRequired}
              disabled={disabled}
              className={cn(
                licensePlateError ? 'border-destructive' : '',
                patentLoading ? 'pr-10' : ''
              )}
            />
            {patentLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {vinData && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="size-3 flex-shrink-0" />
              VIN: {vinData.manufacturer?.name}
              {vinData.year ? ` · ${vinData.year}` : ''}
              {vinData.manufacturer?.country ? ` · ${vinData.manufacturer.country}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Banner de verificación cruzada - advertencia */}
      {mismatchWarning && !warningDismissed && (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 flex-shrink-0 text-warning" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">
                Verificación de patente: datos no coinciden
              </p>
              <p className="mt-1 text-muted-foreground">
                Según el registro, la patente <span className="font-mono font-semibold">{licensePlate}</span> corresponde a{' '}
                <span className="font-semibold">{mismatchWarning.expectedBrand} {mismatchWarning.expectedModel}</span>,
                pero se ingresó <span className="font-semibold">{mismatchWarning.enteredBrand} {mismatchWarning.enteredModel}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => {
                if (patentData) {
                  handleApplySuggestion();
                  setMismatchWarning(null);
                  setVerificationSuccess(true);
                }
              }}
            >
              Aplicar datos oficiales
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => {
                const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
                searchedPlatesRef.current.delete(cleanPlate);
                setMismatchWarning(null);
                setVerificationSuccess(false);
                resetPatent();
                lookupPatent(cleanPlate);
                searchedPlatesRef.current.add(cleanPlate);
              }}
            >
              Revalidar patente
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-muted-foreground"
              onClick={() => {
                setWarningDismissed(true);
                setMismatchWarning(null);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      )}

      {/* Banner de verificación exitosa */}
      {verificationSuccess && !mismatchWarning && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3">
          <CheckCircle2 className="size-5 flex-shrink-0 text-success" />
          <p className="text-sm font-medium text-success">
            Patente verificada: los datos coinciden con el registro oficial
          </p>
        </div>
      )}

      {/* Banner de alerta de robo — informativo, no bloquea el formulario */}
      {stolenAlerts && stolenAlerts.length > 0 && (
        <div className="mt-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 text-destructive flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-destructive text-sm">
                ⚠️ Vehículo con reporte de robo activo
              </p>
              <p className="text-sm text-muted-foreground">
                {stolenAlerts[0].marca} {stolenAlerts[0].modelo}
                {stolenAlerts[0].color ? ` · Color: ${stolenAlerts[0].color}` : ''}
                {stolenAlerts[0].roboLugar ? ` · Robado en ${stolenAlerts[0].roboLugar}` : ''}
                {stolenAlerts[0].fechaRobo ? `, ${stolenAlerts[0].fechaRobo}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Fuente: Registro de vehículos robados GetAPI Chile. Verifica con Carabineros antes de proceder.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dialog para crear nueva marca */}
      <Dialog open={isNewBrandDialogOpen} onOpenChange={setIsNewBrandDialogOpen}>
        <DialogContent className="sm:max-w-md border-border/70 bg-card">
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
        <DialogContent className="sm:max-w-md border-border/70 bg-card">
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
        <DialogContent className="sm:max-w-lg border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="size-5 text-warning" />
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
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>
                    {format(parseFromDatabase(history[0].serviceDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                    {history[0].startTime && (
                      <span className="text-muted-foreground ml-1">
                        a las {history[0].startTime.substring(0, 5)}
                      </span>
                    )}
                  </span>
                </div>
                {history[0].createdAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Registrado {formatDistanceToNow(new Date(history[0].createdAt), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-green-600" />
                  <span className="text-muted-foreground">Origen:</span>
                  <span>{history[0].origin || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-red-600" />
                  <span className="text-muted-foreground">Destino:</span>
                  <span>{history[0].destination || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span>{history[0].client?.name || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Folio:</span>
                  <span className="font-mono">{history[0].folio}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="size-4 text-muted-foreground" />
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

      {/* Dialog de sugerencia de patente */}
      <Dialog open={showSuggestionDialog} onOpenChange={(open) => {
        setShowSuggestionDialog(open);
        if (!open) setSuggestionStep('preview');
      }}>
        <DialogContent className="sm:max-w-md">
          {suggestionStep === 'preview' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <Lightbulb className="size-5" />
                  Datos del Vehículo Encontrados
                </DialogTitle>
                <DialogDescription>
                  Encontramos información para la patente <span className="font-semibold">{licensePlate}</span>
                </DialogDescription>
              </DialogHeader>
              
              <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Marca:</span>
                    <p className="font-medium">{patentData?.marca}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modelo:</span>
                    <p className="font-medium">{patentData?.modelo}</p>
                  </div>
                  {patentData?.año && (
                    <div>
                      <span className="text-muted-foreground">Año:</span>
                      <p className="font-medium">{patentData.año}</p>
                    </div>
                  )}
                  {patentData?.color && (
                    <div>
                      <span className="text-muted-foreground">Color:</span>
                      <p className="font-medium">{patentData.color}</p>
                    </div>
                  )}
                  {patentData?.combustible && (
                    <div>
                      <span className="text-muted-foreground">Combustible:</span>
                      <p className="font-medium">{patentData.combustible}</p>
                    </div>
                  )}
                  {patentData?.transmision && (
                    <div>
                      <span className="text-muted-foreground">Transmisión:</span>
                      <p className="font-medium">{patentData.transmision}</p>
                    </div>
                  )}
                </div>
                {patentData?.rtResultado && (() => {
                  const today = getBusinessTodayDate();
                  const rtDate = patentData.rtFecha ? parseFromDatabase(patentData.rtFecha) : null;
                  const isRTValid = rtDate ? rtDate >= today : false;
                  return (
                    <div className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                      isRTValid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}>
                      {isRTValid ? '✓ RT Aprobada' : '✗ RT Vencida'}
                      {patentData.mesRT && ` · ${isRTValid ? 'Vence' : 'Venció'} ${patentData.mesRT}`}
                    </div>
                  );
                })()}
              </div>
              
              <p className="text-sm text-muted-foreground">
                ¿Desea aplicar esta información al formulario?
              </p>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleIgnoreSuggestion}>
                  Ignorar
                </Button>
                <Button 
                  type="button" 
                  onClick={handleApplySuggestion}
                  disabled={isApplyingSuggestion}
                >
                  {isApplyingSuggestion ? 'Aplicando...' : 'Aplicar Sugerencia'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="size-5" />
                  Crear Marca / Modelo
                </DialogTitle>
                <DialogDescription>
                  {!brandExistsFlag && !modelExistsFlag
                    ? `No encontramos "${patentData?.marca}" ni "${patentData?.modelo}" en el sistema.`
                    : !brandExistsFlag
                    ? `No encontramos la marca "${patentData?.marca}" en el sistema.`
                    : `No encontramos el modelo "${patentData?.modelo}" en el sistema.`
                  }
                  {' '}Puede editar los nombres antes de crear.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-brand-name">Marca</Label>
                  {brandExistsFlag ? (
                    <Input
                      id="edit-brand-name"
                      value={editBrandName}
                      disabled
                      className="bg-muted"
                    />
                  ) : (
                    <Input
                      id="edit-brand-name"
                      value={editBrandName}
                      onChange={(e) => setEditBrandName(e.target.value)}
                      placeholder="Nombre de la marca"
                      autoFocus
                    />
                  )}
                </div>
                
                {patentData?.modelo && patentData.modelo !== 'No disponible' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-model-name">Modelo</Label>
                    {modelExistsFlag ? (
                      <Input
                        id="edit-model-name"
                        value={editModelName}
                        disabled
                        className="bg-muted"
                      />
                    ) : (
                      <Input
                        id="edit-model-name"
                        value={editModelName}
                        onChange={(e) => setEditModelName(e.target.value)}
                        placeholder="Nombre del modelo"
                      />
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setSuggestionStep('preview')}
                >
                  Volver
                </Button>
                <Button 
                  type="button" 
                  onClick={handleConfirmCreate}
                  disabled={isApplyingSuggestion || (!brandExistsFlag && !editBrandName.trim())}
                >
                  {isApplyingSuggestion ? 'Creando...' : 'Crear y Aplicar'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
