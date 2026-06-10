
import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useFolioValidation } from '@/hooks/services/useFolioValidation';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { toTitleCase } from '@/lib/utils';

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
  const { validateFolio, getValidationResult, clearValidation } = useFolioValidation();
  const [hasValidated, setHasValidated] = useState(false);
  const [lastValidatedFolio, setLastValidatedFolio] = useState('');
  const normalizedFolio = folio.trim();
  const shouldShowValidation = hasValidated && lastValidatedFolio === normalizedFolio;
  const validation = useMemo(
    () =>
      shouldShowValidation
        ? getValidationResult(lastValidatedFolio)
        : {
            isValid: true,
            isValidating: false,
            error: null,
          },
    [getValidationResult, lastValidatedFolio, shouldShowValidation]
  );

  useEffect(() => {
    if (!normalizedFolio) {
      if (lastValidatedFolio) {
        clearValidation(lastValidatedFolio);
      }
      setHasValidated(false);
      setLastValidatedFolio('');
      return;
    }

    if (hasValidated && normalizedFolio !== lastValidatedFolio) {
      setHasValidated(false);
    }
  }, [clearValidation, hasValidated, lastValidatedFolio, normalizedFolio]);

  // Notificar cambios de validación al componente padre
  useEffect(() => {
    if (onValidationChange) {
      const isValid = shouldShowValidation ? validation.isValid : true;
      onValidationChange(isValid);
    }
  }, [onValidationChange, shouldShowValidation, validation.isValid]);

  const handleBlur = async () => {
    if (disabled) return;

    if (!normalizedFolio) {
      setHasValidated(false);
      setLastValidatedFolio('');
      return;
    }

    setLastValidatedFolio(normalizedFolio);
    setHasValidated(true);
    await validateFolio(normalizedFolio, isEditing ? serviceId : undefined);
  };

  const getValidationIcon = () => {
    if (!shouldShowValidation || !normalizedFolio) return null;
    
    if (validation.isValidating) {
      return <Loader2 className="size-4 animate-spin text-yellow-500" />;
    }
    
    if (validation.isValid) {
      return <CheckCircle className="size-4 text-green-500" />;
    }
    
    if (validation.error) {
      return <AlertCircle className="size-4 text-red-500" />;
    }
    
    return null;
  };

  const getValidationMessage = () => {
    // Mostrar mensaje de generación automática si no hay folio y no es manual
    if (!normalizedFolio && !isManualFolio && !isEditing) {
      return <span className="text-sm text-blue-600">ℹ️ El folio se generará automáticamente al guardar</span>;
    }
    
    if (!shouldShowValidation || !normalizedFolio) {
      return <span className="text-sm text-muted-foreground">Valida el folio al salir del campo.</span>;
    }
    
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
            Cliente: {toTitleCase(validation.existingService.clientName)} • Creado: {createdDate}
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
          onBlur={() => {
            void handleBlur();
          }}
          placeholder={!isManualFolio && !isEditing ? "(Se generará automáticamente)" : "Ej: SRV-1001"}
          disabled={disabled}
          className={`pr-10 ${
            shouldShowValidation && normalizedFolio
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
      <div className="min-h-14">
        {getValidationMessage()}
      </div>
    </div>
  );
};
