import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, XCircle } from 'lucide-react';
import { ValidationError } from '@/hooks/services/useServiceFormValidation';

interface ServiceValidationAlertsProps {
  errors: ValidationError[];
  className?: string;
}

export const ServiceValidationAlerts: React.FC<ServiceValidationAlertsProps> = ({
  errors,
  className = ''
}) => {
  const criticalErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  if (criticalErrors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 mb-4 ${className}`}>
      {criticalErrors.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <XCircle className="size-4 flex-shrink-0" />
          <AlertTitle className="font-semibold text-sm">
            Campos requeridos ({criticalErrors.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              {criticalErrors.map((error, index) => (
                <li key={index} className="break-words">{error.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium">
              Complete estos campos para guardar
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Avisos informativos: NO bloquean el guardado. Un servicio cerrado sin
          pin no puede quedar inmovilizado por un campo que nadie está editando. */}
      {warnings.length > 0 && (
        <Alert className="border-info/40 bg-info-soft">
          <Info className="size-4 text-info-text flex-shrink-0" />
          <AlertTitle className="font-semibold text-info-text text-sm">
            Avisos ({warnings.length})
          </AlertTitle>
          <AlertDescription className="text-info-text">
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              {warnings.map((warning, index) => (
                <li key={index} className="break-words">{warning.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium">
              Puedes guardar de todas formas
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
