
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Download, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  FileText,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useBackupManager } from '@/hooks/useBackupManager';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const BackupManagementSection = () => {
  const { 
    progress, 
    backupLogs, 
    generateAndDownloadBackup,
    error: hookError,
    refetchLogs
  } = useBackupManager();

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
        return <Badge variant="default" className="bg-green-500">Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      case 'started':
        return <Badge variant="secondary">En Progreso</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const lastSuccessfulBackup = backupLogs?.find(log => log.status === 'completed');

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Database className="w-5 h-5 text-tms-green" />
          <span>Gestión de Respaldos</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchLogs()}
            className="ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mostrar error del hook si existe */}
        {hookError && (
          <Alert className="bg-red-500/10 border-red-500/20">
            <XCircle className="w-4 h-4 text-red-500" />
            <AlertDescription className="text-red-300">
              Error al cargar datos de respaldos: {hookError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Estado del último respaldo */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Estado del Sistema</h4>
          {lastSuccessfulBackup ? (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <AlertDescription className="text-green-300">
                Último respaldo exitoso: {' '}
                {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
                {lastSuccessfulBackup.metadata?.fileName && (
                  <span className="block text-xs mt-1">
                    Archivo: {lastSuccessfulBackup.metadata.fileName}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <AlertDescription className="text-yellow-300">
                No se encontraron respaldos anteriores. Se recomienda generar un respaldo.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator className="bg-gray-700" />

        {/* Controles de respaldo */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-300">Generar Respaldo Manual</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Button
                onClick={() => generateAndDownloadBackup('full')}
                disabled={progress.isGenerating}
                className="w-full bg-tms-green hover:bg-tms-green-dark text-white"
              >
                {progress.isGenerating && progress.stage.includes('Completo') ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Respaldo Completo
              </Button>
              <p className="text-xs text-gray-400">
                Incluye todos los datos del sistema (recomendado)
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => generateAndDownloadBackup('quick')}
                disabled={progress.isGenerating}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                {progress.isGenerating && progress.stage.includes('Rápido') ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Respaldo Rápido
              </Button>
              <p className="text-xs text-gray-400">
                Solo configuración y estadísticas básicas
              </p>
            </div>
          </div>

          {/* Progreso del respaldo */}
          {progress.isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{progress.stage}</span>
                <span className="text-gray-400">{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="w-full" />
            </div>
          )}

          {progress.error && (
            <Alert className="bg-red-500/10 border-red-500/20">
              <XCircle className="w-4 h-4 text-red-500" />
              <AlertDescription className="text-red-300">
                Error: {progress.error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator className="bg-gray-700" />

        {/* Historial de respaldos */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-300">Historial de Respaldos</h4>
          
          {backupLogs && backupLogs.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {backupLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        {log.backup_type === 'full' ? (
                          <FileText className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Zap className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-gray-300">
                          {log.backup_type === 'full' ? 'Completo' : 'Rápido'}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(log.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                        {log.file_size_bytes && (
                          <span> • {formatFileSize(log.file_size_bytes)}</span>
                        )}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-red-400 mt-1">
                          {log.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No hay respaldos registrados
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Genera tu primer respaldo usando los botones de arriba
              </p>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <AlertTriangle className="w-4 h-4 text-blue-400" />
          <AlertDescription className="text-blue-300 text-sm">
            <strong>Importante:</strong> Almacene los respaldos en ubicaciones seguras y externas al sistema. 
            Los respaldos completos permiten restauración total en caso de emergencia.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
