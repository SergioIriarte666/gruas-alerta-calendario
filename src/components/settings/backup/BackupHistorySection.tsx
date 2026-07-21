
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Database, CheckCircle, XCircle, Clock, FileText, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BackupLog } from '@/types/backup';

interface BackupHistorySectionProps {
  backupLogs?: (BackupLog & { profiles: { email: string; full_name: string } })[];
}

export const BackupHistorySection: React.FC<BackupHistorySectionProps> = ({ backupLogs }) => {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="size-4 text-success" />;
      case 'failed':
        return <XCircle className="size-4 text-danger" />;
      case 'started':
        return <Clock className="size-4 text-warning" />;
      default:
        return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="border-success/30 bg-success-soft text-success">Completado</Badge>;
      case 'failed':
        return <Badge variant="outline" className="border-danger/30 bg-danger-soft text-danger">Fallido</Badge>;
      case 'started':
        return <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">En progreso</Badge>;
      default:
        return <Badge variant="outline" className="border-border text-muted-foreground">Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">Historial de Respaldos</h4>
      
      {backupLogs && backupLogs.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {backupLogs.map(log => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-x-3">
                {getStatusIcon(log.status)}
                <div>
                  <div className="flex items-center gap-x-2 mb-1">
                    {log.backup_type === 'full' ? (
                      <FileText className="size-4 text-muted-foreground" />
                    ) : (
                      <Zap className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {log.backup_type === 'full' ? 'Completo' : 'Rápido'}
                    </span>
                    {getStatusBadge(log.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: es
                    })}
                    {log.file_size_bytes && (
                      <span> • {formatFileSize(log.file_size_bytes)}</span>
                    )}
                  </p>
                  {log.error_message && (
                    <p className="mt-1 rounded bg-danger-soft px-2 py-1 text-xs text-foreground">
                      {log.error_message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card py-8 text-center">
          <Database className="mx-auto mb-2 size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay respaldos registrados
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Genera tu primer respaldo usando los botones de arriba
          </p>
        </div>
      )}
    </div>
  );
};
