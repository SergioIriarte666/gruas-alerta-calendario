
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FormActionsProps {
  onCancel: () => void;
  isEditing: boolean;
  disabled: boolean;
  loading?: boolean;
  validationErrorCount?: number;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  isEditing,
  disabled,
  loading = false,
  validationErrorCount = 0
}) => {
  const hasValidationErrors = validationErrorCount > 0;
  
  return (
    <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4 pt-6 border-t">
      {hasValidationErrors && !loading && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4" />
          {validationErrorCount} campo{validationErrorCount !== 1 ? 's' : ''} requerido{validationErrorCount !== 1 ? 's' : ''} sin completar
        </p>
      )}
      
      <div className="flex gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button 
                  type="submit" 
                  disabled={disabled || loading}
                  className="min-w-32"
                >
                  {loading ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : hasValidationErrors ? (
                    <AlertCircle className="size-4 mr-2" />
                  ) : null}
                  {loading ? 'Procesando...' : `${isEditing ? 'Actualizar' : 'Crear'} Servicio`}
                </Button>
              </span>
            </TooltipTrigger>
            {hasValidationErrors && (
              <TooltipContent>
                <p>Complete los campos requeridos marcados en rojo</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};
