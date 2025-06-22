
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
      <h4 className="text-sm font-medium text-black">Estado del Sistema</h4>
      
      {/* Error del hook */}
      {hookError && (
        <Alert 
          className="border-red-200 bg-white" 
          style={{ background: '#ffffff', color: '#000000', borderColor: '#fecaca' }}
        >
          <XCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-700" style={{ color: '#b91c1c' }}>
            Error al cargar datos de respaldos: {hookError.message}
          </AlertDescription>
        </Alert>
      )}

      {lastSuccessfulBackup ? (
        <Alert 
          className="border-green-200 bg-white" 
          style={{ background: '#ffffff', color: '#000000', borderColor: '#bbf7d0' }}
        >
          <CheckCircle className="w-4 h-4 text-green-500" />
          <AlertDescription className="text-green-700" style={{ color: '#15803d' }}>
            Último respaldo exitoso: {' '}
            {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at), {
              addSuffix: true,
              locale: es
            })}
            {lastSuccessfulBackup.metadata?.fileName && (
              <span className="block text-xs mt-1 text-green-600" style={{ color: '#16a34a' }}>
                Archivo: {lastSuccessfulBackup.metadata.fileName}
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert 
          className="border-yellow-200 bg-white" 
          style={{ background: '#ffffff', color: '#000000', borderColor: '#fde047' }}
        >
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <AlertDescription className="text-yellow-700" style={{ color: '#a16207' }}>
            No se encontraron respaldos anteriores. Se recomienda generar un respaldo.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
