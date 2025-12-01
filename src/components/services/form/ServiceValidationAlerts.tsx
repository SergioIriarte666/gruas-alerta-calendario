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
    <div className={`space-y-3 ${className}`}>
      {criticalErrors.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <XCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold">
            Campos requeridos sin completar ({criticalErrors.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
              {criticalErrors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium">
              Complete estos campos para poder guardar el servicio
            </p>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="font-semibold text-yellow-800 dark:text-yellow-200">
            Advertencias ({warnings.length})
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
              {warnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
