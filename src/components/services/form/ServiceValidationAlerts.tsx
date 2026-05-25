import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, XCircle } from 'lucide-react';
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

      {warnings.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="size-4 text-yellow-600 flex-shrink-0" />
          <AlertTitle className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm">
            Advertencias ({warnings.length})
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              {warnings.map((warning, index) => (
                <li key={index} className="break-words">{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
