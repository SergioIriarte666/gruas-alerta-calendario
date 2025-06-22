
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, AlertTriangle, RefreshCw } from 'lucide-react';
import { useBackupManager } from '@/hooks/useBackupManager';
import { BackupStatusSection } from './backup/BackupStatusSection';
import { BackupControlsSection } from './backup/BackupControlsSection';
import { BackupHistorySection } from './backup/BackupHistorySection';

export const BackupManagementSection = () => {
  const {
    progress,
    backupLogs,
    generateAndDownloadBackup,
    error: hookError,
    refetchLogs
  } = useBackupManager();

  const lastSuccessfulBackup = backupLogs?.find(log => log.status === 'completed');

  return (
    <Card className="bg-white border-gray-200 mt-6" style={{ background: '#ffffff' }}>
      <CardHeader className="bg-white border-b border-gray-200 p-6" style={{ background: '#ffffff' }}>
        <CardTitle className="flex items-center justify-between text-black">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-tms-green" />
            <span>Gestión de Respaldos</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetchLogs()} 
            className="text-gray-600 hover:text-black hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 bg-white p-6" style={{ background: '#ffffff' }}>
        <BackupStatusSection 
          lastSuccessfulBackup={lastSuccessfulBackup}
          hookError={hookError}
        />

        <Separator className="bg-gray-200" />

        <BackupControlsSection 
          progress={progress}
          onGenerateBackup={generateAndDownloadBackup}
        />

        <Separator className="bg-gray-200" />

        <BackupHistorySection backupLogs={backupLogs} />

        {/* Información adicional */}
        <Alert 
          className="border-blue-200" 
          style={{ background: '#ffffff', color: '#000000', borderColor: '#bfdbfe' }}
        >
          <AlertTriangle className="w-4 h-4 text-blue-500" />
          <AlertDescription className="text-sm text-blue-700" style={{ color: '#1d4ed8' }}>
            <strong>Importante:</strong> Almacene los respaldos en ubicaciones seguras y externas al sistema. 
            Los respaldos completos permiten restauración total en caso de emergencia.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
