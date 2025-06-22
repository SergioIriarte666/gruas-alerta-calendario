
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
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'started':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="text-green-600 border-green-500/30 bg-green-100">Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-100 text-red-600 border-red-500/30">Fallido</Badge>;
      case 'started':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-600 border-yellow-500/30">En Progreso</Badge>;
      default:
        return <Badge variant="outline" className="border-gray-300 text-gray-600">Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-black">Historial de Respaldos</h4>
      
      {backupLogs && backupLogs.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {backupLogs.map(log => (
            <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border bg-white border-gray-200" style={{ background: '#ffffff' }}>
              <div className="flex items-center space-x-3">
                {getStatusIcon(log.status)}
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    {log.backup_type === 'full' ? (
                      <FileText className="w-4 h-4 text-gray-600" />
                    ) : (
                      <Zap className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-sm font-medium text-black">
                      {log.backup_type === 'full' ? 'Completo' : 'Rápido'}
                    </span>
                    {getStatusBadge(log.status)}
                  </div>
                  <p className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: es
                    })}
                    {log.file_size_bytes && (
                      <span> • {formatFileSize(log.file_size_bytes)}</span>
                    )}
                  </p>
                  {log.error_message && (
                    <p className="text-xs mt-1 px-2 py-1 rounded text-red-600 bg-red-50" style={{ color: '#dc2626', background: '#fef2f2' }}>
                      {log.error_message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 rounded-lg border bg-white border-gray-200" style={{ background: '#ffffff' }}>
          <Database className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">
            No hay respaldos registrados
          </p>
          <p className="text-xs mt-1 text-gray-500">
            Genera tu primer respaldo usando los botones de arriba
          </p>
        </div>
      )}
    </div>
  );
};
