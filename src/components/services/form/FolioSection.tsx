
import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import { FolioInput } from './FolioInput';

interface FolioSectionProps {
  folio: string;
  onFolioChange: (value: string) => void;
  isManualFolio: boolean;
  onManualFolioChange: (value: boolean) => void;
  onGenerateNewFolio: () => void;
  isEditing?: boolean;
  serviceId?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export const FolioSection: React.FC<FolioSectionProps> = ({
  folio,
  onFolioChange,
  isManualFolio,
  onManualFolioChange,
  onGenerateNewFolio,
  isEditing = false,
  serviceId,
  isLoading = false,
  disabled = false,
  onValidationChange
}) => {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold">Identificación del Servicio</h3>
      
      {!isEditing && (
        <div className="flex items-center space-x-3">
          <Switch
            id="manual-folio"
            checked={isManualFolio}
            onCheckedChange={onManualFolioChange}
            disabled={disabled}
          />
          <Label htmlFor="manual-folio" className="text-sm">
            Folio manual (personalizado)
          </Label>
        </div>
      )}

      <div className="flex space-x-3">
        <div className="flex-1">
          <FolioInput
            folio={folio}
            onFolioChange={onFolioChange}
            isEditing={isEditing}
            serviceId={serviceId}
            disabled={disabled}
            onValidationChange={onValidationChange}
            isManualFolio={isManualFolio}
          />
        </div>
        
        {!isEditing && !isManualFolio && (
          <Button
            type="button"
            variant="outline"
            onClick={onGenerateNewFolio}
            disabled={isLoading || disabled}
            className="mt-6"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Regenerar
          </Button>
        )}
      </div>
    </div>
  );
};
