
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

  // Debug logging moved to component logic
  console.log('BackupManagementSection component is rendering');
  console.log('BackupManagementSection - Hook data loaded:', { progress, backupLogs, hookError });

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
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Fallido</Badge>;
      case 'started':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En Progreso</Badge>;
      default:
        return <Badge variant="outline" className="border-gray-600 text-gray-400">Desconocido</Badge>;
    }
  };

  const lastSuccessfulBackup = backupLogs?.find(log => log.status === 'completed');

  return (
    <Card 
      className="settings-card"
      style={{
        backgroundColor: '#000000 !important',
        border: '1px solid #9cfa24 !important',
        borderRadius: '8px',
        backdropFilter: 'blur(8px)',
        marginTop: '24px'
      }}
      data-component="backup-management"
    >
      <CardHeader 
        style={{
          backgroundColor: '#000000',
          borderBottom: '1px solid rgba(156, 250, 36, 0.3)',
          padding: '24px'
        }}
      >
        <CardTitle className="flex items-center justify-between" style={{ color: '#ffffff' }}>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5" style={{ color: '#9cfa24' }} />
            <span>Gestión de Respaldos</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchLogs()}
            style={{
              color: '#999999',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(156, 250, 36, 0.1)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#999999';
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6" style={{ backgroundColor: '#000000', padding: '24px' }}>
        {/* Mostrar error del hook si existe */}
        {hookError && (
          <Alert 
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px'
            }}
          >
            <XCircle className="w-4 h-4 text-red-500" />
            <AlertDescription style={{ color: 'rgb(252, 165, 165)' }}>
              Error al cargar datos de respaldos: {hookError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Estado del último respaldo */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium" style={{ color: '#ffffff' }}>Estado del Sistema</h4>
          {lastSuccessfulBackup ? (
            <Alert 
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px'
              }}
            >
              <CheckCircle className="w-4 h-4 text-green-500" />
              <AlertDescription style={{ color: 'rgb(134, 239, 172)' }}>
                Último respaldo exitoso: {' '}
                {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
                {lastSuccessfulBackup.metadata?.fileName && (
                  <span className="block text-xs mt-1" style={{ color: 'rgb(74, 222, 128)' }}>
                    Archivo: {lastSuccessfulBackup.metadata.fileName}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert 
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '8px'
              }}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <AlertDescription style={{ color: 'rgb(253, 224, 71)' }}>
                No se encontraron respaldos anteriores. Se recomienda generar un respaldo.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />

        {/* Controles de respaldo */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium" style={{ color: '#ffffff' }}>Generar Respaldo Manual</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Button
                onClick={() => generateAndDownloadBackup('full')}
                disabled={progress.isGenerating}
                className="w-full bg-tms-green text-black font-medium hover:bg-tms-green/80"
                style={{
                  backgroundColor: '#9cfa24',
                  color: '#000000',
                  fontWeight: '500',
                  border: 'none'
                }}
              >
                {progress.isGenerating && progress.stage.includes('Completo') ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Respaldo Completo
              </Button>
              <p className="text-xs" style={{ color: '#999999' }}>
                Incluye todos los datos del sistema (recomendado)
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => generateAndDownloadBackup('quick')}
                disabled={progress.isGenerating}
                variant="outline"
                className="w-full"
                style={{
                  border: '1px solid rgba(156, 250, 36, 0.3)',
                  color: '#ffffff',
                  backgroundColor: 'transparent'
                }}
              >
                {progress.isGenerating && progress.stage.includes('Rápido') ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Respaldo Rápido
              </Button>
              <p className="text-xs" style={{ color: '#999999' }}>
                Solo configuración y estadísticas básicas
              </p>
            </div>
          </div>

          {/* Progreso del respaldo */}
          {progress.isGenerating && (
            <div 
              className="space-y-2 p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(156, 250, 36, 0.3)'
              }}
            >
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#ffffff' }}>{progress.stage}</span>
                <span style={{ color: '#999999' }}>{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="w-full h-2" />
            </div>
          )}

          {progress.error && (
            <Alert 
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px'
              }}
            >
              <XCircle className="w-4 h-4 text-red-500" />
              <AlertDescription style={{ color: 'rgb(252, 165, 165)' }}>
                Error: {progress.error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />

        {/* Historial de respaldos */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium" style={{ color: '#ffffff' }}>Historial de Respaldos</h4>
          
          {backupLogs && backupLogs.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {backupLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(156, 250, 36, 0.3)'
                  }}
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        {log.backup_type === 'full' ? (
                          <FileText className="w-4 h-4" style={{ color: '#999999' }} />
                        ) : (
                          <Zap className="w-4 h-4" style={{ color: '#999999' }} />
                        )}
                        <span className="text-sm font-medium" style={{ color: '#ffffff' }}>
                          {log.backup_type === 'full' ? 'Completo' : 'Rápido'}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-xs" style={{ color: '#999999' }}>
                        {formatDistanceToNow(new Date(log.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                        {log.file_size_bytes && (
                          <span> • {formatFileSize(log.file_size_bytes)}</span>
                        )}
                      </p>
                      {log.error_message && (
                        <p 
                          className="text-xs mt-1 px-2 py-1 rounded"
                          style={{
                            color: 'rgb(252, 165, 165)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)'
                          }}
                        >
                          {log.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div 
              className="text-center py-8 rounded-lg border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(156, 250, 36, 0.3)'
              }}
            >
              <Database className="w-12 h-12 mx-auto mb-2" style={{ color: '#999999' }} />
              <p className="text-sm" style={{ color: '#999999' }}>
                No hay respaldos registrados
              </p>
              <p className="text-xs mt-1" style={{ color: '#666666' }}>
                Genera tu primer respaldo usando los botones de arriba
              </p>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <Alert 
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px'
          }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: 'rgb(96, 165, 250)' }} />
          <AlertDescription className="text-sm" style={{ color: 'rgb(147, 197, 253)' }}>
            <strong>Importante:</strong> Almacene los respaldos en ubicaciones seguras y externas al sistema. 
            Los respaldos completos permiten restauración total en caso de emergencia.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
