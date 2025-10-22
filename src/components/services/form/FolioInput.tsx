
import React, { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useFolioValidation } from '@/hooks/services/useFolioValidation';
import { useDebounce } from '@/hooks/useDebounce';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';

interface FolioInputProps {
  folio: string;
  onFolioChange: (value: string) => void;
  isEditing?: boolean;
  serviceId?: string;
  disabled?: boolean;
  onValidationChange?: (isValid: boolean) => void;
  isManualFolio?: boolean;
}

export const FolioInput: React.FC<FolioInputProps> = ({
  folio,
  onFolioChange,
  isEditing = false,
  serviceId,
  disabled = false,
  onValidationChange,
  isManualFolio = false
}) => {
  const { validateFolio, getValidationResult, hasValidationResult, clearValidation } = useFolioValidation();
  const [hasValidated, setHasValidated] = useState(false);
  
  // Debounce del folio para evitar múltiples validaciones
  const debouncedFolio = useDebounce(folio, 500);
  
  const validation = getValidationResult(debouncedFolio);

  // Validar el folio cuando cambie el valor debounced
  useEffect(() => {
    if (debouncedFolio.trim() && !disabled) {
      setHasValidated(true);
      validateFolio(debouncedFolio, isEditing ? serviceId : undefined);
    } else if (!debouncedFolio.trim()) {
      clearValidation(debouncedFolio);
      setHasValidated(false);
    }
  }, [debouncedFolio, validateFolio, clearValidation, isEditing, serviceId, disabled]);

  // Notificar cambios de validación al componente padre
  useEffect(() => {
    if (onValidationChange) {
      // Si no se ha validado aún, permitir continuar (true)
      // Si se está validando o ya se validó, usar el resultado real
      const isValid = hasValidated ? validation.isValid : true;
      onValidationChange(isValid);
    }
  }, [validation.isValid, hasValidated, onValidationChange]);

  const getValidationIcon = () => {
    if (!hasValidated || !folio.trim()) return null;
    
    if (validation.isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    }
    
    if (validation.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (validation.error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    return null;
  };

  const getValidationMessage = () => {
    // Mostrar mensaje de generación automática si no hay folio y no es manual
    if (!folio.trim() && !isManualFolio && !isEditing) {
      return <span className="text-sm text-blue-600">ℹ️ El folio se generará automáticamente al guardar</span>;
    }
    
    if (!hasValidated || !folio.trim()) return null;
    
    if (validation.isValidating) {
      return <span className="text-sm text-yellow-600">Validando folio...</span>;
    }
    
    if (validation.isValid) {
      return <span className="text-sm text-green-600">✅ Folio disponible</span>;
    }
    
    if (validation.error && validation.existingService) {
      const createdDate = formatForDisplay(parseFromDatabase(validation.existingService.createdAt));
      return (
        <div className="text-sm text-red-600">
          <div className="font-medium">❌ {validation.error}</div>
          <div className="text-xs mt-1">
            Cliente: {validation.existingService.clientName} • Creado: {createdDate}
          </div>
        </div>
      );
    }
    
    if (validation.error) {
      return <span className="text-sm text-red-600">❌ {validation.error}</span>;
    }
    
    return null;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="folio">
        Folio del Servicio <span className="text-red-500">*</span>
      </Label>
      <div className="relative">
        <Input
          id="folio"
          type="text"
          value={folio}
          onChange={(e) => onFolioChange(e.target.value)}
          placeholder={!isManualFolio && !isEditing ? "(Se generará automáticamente)" : "Ej: SRV-1001"}
          disabled={disabled}
          className={`pr-10 ${
            hasValidated && folio.trim()
              ? validation.isValid
                ? 'border-green-500 focus:border-green-500'
                : 'border-red-500 focus:border-red-500'
              : ''
          }`}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getValidationIcon()}
        </div>
      </div>
      {getValidationMessage()}
    </div>
  );
};
