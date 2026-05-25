
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { useBackupManager } from '@/hooks/useBackupManager';
import { BackupStatusSection } from './backup/BackupStatusSection';
import { BackupControlsSection } from './backup/BackupControlsSection';
import { BackupHistorySection } from './backup/BackupHistorySection';
import { BackupEmailSchedulerSection } from './backup/BackupEmailSchedulerSection';

export const BackupManagementSection = () => {
  const {
    progress,
    backupLogs,
    lastGeneratedBackup,
    downloadBackup,
    generateAndDownloadBackup,
    error: hookError,
    refetchLogs
  } = useBackupManager();

  const lastSuccessfulBackup = backupLogs?.find(log => log.status === 'completed');

  return (
    <Card id="respaldos" className="bg-card border mt-6 scroll-mt-24">
      <CardHeader className="border-b p-4 sm:p-6">
        <CardTitle className="flex items-center justify-between text-foreground">
          <div className="flex items-center space-x-2">
            <Database className="size-5 text-tms-green" />
            <span className="text-lg sm:text-xl">Gestión de Respaldos</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetchLogs()} 
          >
            <RefreshCw className="size-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <BackupStatusSection 
          lastSuccessfulBackup={lastSuccessfulBackup}
          hookError={hookError}
        />

        <Separator />

        <BackupControlsSection 
          progress={progress}
          onGenerateBackup={generateAndDownloadBackup}
          lastGeneratedBackup={lastGeneratedBackup}
          onDownloadBackup={() => {
            if (!lastGeneratedBackup?.content || !lastGeneratedBackup.fileName || !lastGeneratedBackup.type) {
              return;
            }

            downloadBackup(
              lastGeneratedBackup.content,
              lastGeneratedBackup.fileName,
              lastGeneratedBackup.type,
            );
          }}
        />

        <Separator />

        <BackupHistorySection backupLogs={backupLogs} />

        {/* Información adicional */}
        <Alert className="border-info/30 bg-info-soft">
          <AlertTriangle className="size-4 text-info" />
          <AlertDescription className="flex flex-col gap-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>Importante:</strong> Almacene los respaldos en ubicaciones seguras y externas al sistema.
              {' '}Los respaldos completos permiten restauración total en caso de emergencia.
            </span>

            {lastGeneratedBackup?.content && lastGeneratedBackup.fileName && lastGeneratedBackup.type ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => downloadBackup(
                  lastGeneratedBackup.content!,
                  lastGeneratedBackup.fileName!,
                  lastGeneratedBackup.type!,
                )}
              >
                <Download className="mr-2 size-4" />
                Descargar archivo
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </CardContent>
      <BackupEmailSchedulerSection />
    </Card>
  );
};
