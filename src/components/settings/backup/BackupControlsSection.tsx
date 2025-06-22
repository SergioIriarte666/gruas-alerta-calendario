
import React from 'react';
import { Button } from '@/components/ui/button';
import { Database, Zap, RefreshCw } from 'lucide-react';
import { BackupProgressDisplay } from './BackupProgressDisplay';
import type { BackupProgress } from '@/types/backup';

interface BackupControlsSectionProps {
  progress: BackupProgress;
  onGenerateBackup: (type: 'full' | 'quick') => void;
}

export const BackupControlsSection: React.FC<BackupControlsSectionProps> = ({
  progress,
  onGenerateBackup
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-black">Generar Respaldo Manual</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Button 
            onClick={() => onGenerateBackup('full')} 
            disabled={progress.isGenerating} 
            className="w-full bg-tms-green text-black font-medium hover:bg-tms-green/80"
          >
            {progress.isGenerating && progress.stage.includes('Completo') ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Respaldo Completo
          </Button>
          <p className="text-xs text-gray-600">
            Incluye todos los datos del sistema (recomendado)
          </p>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={() => onGenerateBackup('quick')} 
            disabled={progress.isGenerating} 
            variant="outline" 
            className="w-full border-gray-300 text-black bg-white hover:bg-gray-50"
          >
            {progress.isGenerating && progress.stage.includes('Rápido') ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Respaldo Rápido
          </Button>
          <p className="text-xs text-gray-600">
            Solo configuración y estadísticas básicas
          </p>
        </div>
      </div>

      <BackupProgressDisplay progress={progress} />
    </div>
  );
};
