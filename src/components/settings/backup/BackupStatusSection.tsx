
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BackupLog } from '@/types/backup';

interface BackupStatusSectionProps {
  lastSuccessfulBackup?: BackupLog;
  hookError?: Error | null;
}

export const BackupStatusSection: React.FC<BackupStatusSectionProps> = ({
  lastSuccessfulBackup,
  hookError
}) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Estado del Sistema</h4>
      
      {/* Error del hook */}
      {hookError && (
        <Alert variant="destructive">
          <XCircle className="w-4 h-4 text-danger" />
          <AlertDescription className="text-foreground">
            Error al cargar datos de respaldos: {hookError.message}
          </AlertDescription>
        </Alert>
      )}

      {lastSuccessfulBackup ? (
        <Alert className="border-success/30 bg-success-soft">
          <CheckCircle className="w-4 h-4 text-success" />
          <AlertDescription className="text-foreground">
            Último respaldo exitoso: {' '}
            {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at), {
              addSuffix: true,
              locale: es
            })}
            {lastSuccessfulBackup.metadata?.fileName && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Archivo: {lastSuccessfulBackup.metadata.fileName}
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-warning/30 bg-warning-soft">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <AlertDescription className="text-foreground">
            No se encontraron respaldos anteriores. Se recomienda generar un respaldo.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
