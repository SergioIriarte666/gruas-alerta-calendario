import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Download, Clock, AlertTriangle, CheckCircle, XCircle, FileText, Zap, RefreshCw } from 'lucide-react';
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
        return <Badge variant="default" className="text-green-400 border-green-500/30 bg-zinc-500">Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Fallido</Badge>;
      case 'started':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En Progreso</Badge>;
      default:
        return <Badge variant="outline" className="border-gray-600 text-gray-400">Desconocido</Badge>;
    }
  };
  const lastSuccessfulBackup = backupLogs?.find(log => log.status === 'completed');
  return <Card className="bg-black border-tms-green mt-6">
      <CardHeader className="bg-black border-b border-tms-green/30 p-6">
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-tms-green" />
            <span>Gestión de Respaldos</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchLogs()} className="text-gray-400 hover:text-white hover:bg-tms-green/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 bg-black p-6">
        {/* Error del hook */}
        {hookError && <Alert className="bg-red-500/10 border-red-500/20">
            <XCircle className="w-4 h-4 text-red-500" />
            <AlertDescription className="text-red-300">
              Error al cargar datos de respaldos: {hookError.message}
            </AlertDescription>
          </Alert>}

        {/* Estado del último respaldo */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-white">Estado del Sistema</h4>
          {lastSuccessfulBackup ? <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <AlertDescription className="text-green-300">
                Último respaldo exitoso: {' '}
                {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at), {
              addSuffix: true,
              locale: es
            })}
                {lastSuccessfulBackup.metadata?.fileName && <span className="block text-xs mt-1 text-green-400">
                    Archivo: {lastSuccessfulBackup.metadata.fileName}
                  </span>}
              </AlertDescription>
            </Alert> : <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <AlertDescription className="text-yellow-300">
                No se encontraron respaldos anteriores. Se recomienda generar un respaldo.
              </AlertDescription>
            </Alert>}
        </div>

        <Separator className="bg-tms-green/30" />

        {/* Controles de respaldo */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-white">Generar Respaldo Manual</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Button onClick={() => generateAndDownloadBackup('full')} disabled={progress.isGenerating} className="w-full bg-tms-green text-black font-medium hover:bg-tms-green/80">
                {progress.isGenerating && progress.stage.includes('Completo') ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                Respaldo Completo
              </Button>
              <p className="text-xs text-gray-400">
                Incluye todos los datos del sistema (recomendado)
              </p>
            </div>

            <div className="space-y-2">
              <Button onClick={() => generateAndDownloadBackup('quick')} disabled={progress.isGenerating} variant="outline" className="w-full border-tms-green/30 text-white bg-transparent hover:bg-tms-green/10">
                {progress.isGenerating && progress.stage.includes('Rápido') ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Respaldo Rápido
              </Button>
              <p className="text-xs text-gray-400">
                Solo configuración y estadísticas básicas
              </p>
            </div>
          </div>

          {/* Progreso del respaldo */}
          {progress.isGenerating && <div className="space-y-2 p-4 rounded-lg border bg-white/5 border-tms-green/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white">{progress.stage}</span>
                <span className="text-gray-400">{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="w-full h-2" />
            </div>}

          {progress.error && <Alert className="bg-red-500/10 border-red-500/20">
              <XCircle className="w-4 h-4 text-red-500" />
              <AlertDescription className="text-red-300">
                Error: {progress.error}
              </AlertDescription>
            </Alert>}
        </div>

        <Separator className="bg-tms-green/30" />

        {/* Historial de respaldos */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-white">Historial de Respaldos</h4>
          
          {backupLogs && backupLogs.length > 0 ? <div className="space-y-3 max-h-64 overflow-y-auto">
              {backupLogs.map(log => <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border bg-white/5 border-tms-green/30">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        {log.backup_type === 'full' ? <FileText className="w-4 h-4 text-gray-400" /> : <Zap className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm font-medium text-white">
                          {log.backup_type === 'full' ? 'Completo' : 'Rápido'}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                    locale: es
                  })}
                        {log.file_size_bytes && <span> • {formatFileSize(log.file_size_bytes)}</span>}
                      </p>
                      {log.error_message && <p className="text-xs mt-1 px-2 py-1 rounded text-red-300 bg-red-500/10">
                          {log.error_message}
                        </p>}
                    </div>
                  </div>
                </div>)}
            </div> : <div className="text-center py-8 rounded-lg border bg-white/5 border-tms-green/30">
              <Database className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-400">
                No hay respaldos registrados
              </p>
              <p className="text-xs mt-1 text-gray-500">
                Genera tu primer respaldo usando los botones de arriba
              </p>
            </div>}
        </div>

        {/* Información adicional */}
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <AlertTriangle className="w-4 h-4 text-blue-400" />
          <AlertDescription className="text-sm text-blue-300">
            <strong>Importante:</strong> Almacene los respaldos en ubicaciones seguras y externas al sistema. 
            Los respaldos completos permiten restauración total en caso de emergencia.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>;
};