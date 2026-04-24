
import React from 'react';
import { Button } from '@/components/ui/button';
import { Database, Zap, RefreshCw, FileCode, FileText } from 'lucide-react';
import { BackupProgressDisplay } from './BackupProgressDisplay';
import type { BackupProgress } from '@/types/backup';

interface BackupControlsSectionProps {
  progress: BackupProgress;
  onGenerateBackup: (type: 'full' | 'quick', format?: 'json' | 'sql') => void;
}

export const BackupControlsSection: React.FC<BackupControlsSectionProps> = ({
  progress,
  onGenerateBackup
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">Generar Respaldo Manual</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Respaldo Completo */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Respaldo Completo</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <Button 
              onClick={() => onGenerateBackup('full', 'sql')} 
              disabled={progress.isGenerating} 
              className="w-full bg-gradient-primary font-medium text-primary-foreground hover:opacity-95"
            >
              {progress.isGenerating && progress.stage.includes('SQL') ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileCode className="w-4 h-4 mr-2" />
              )}
              Dump SQL
            </Button>
            
            <Button 
              onClick={() => onGenerateBackup('full', 'json')} 
              disabled={progress.isGenerating} 
              variant="outline" 
              className="w-full border-primary text-primary hover:bg-primary-soft"
            >
              {progress.isGenerating && progress.stage.includes('JSON') ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Export JSON
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Incluye todos los datos del sistema. SQL para restauración completa, JSON para análisis.
          </p>
        </div>

        {/* Respaldo Rápido */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Respaldo Rápido</span>
          </div>
          
          <Button 
            onClick={() => onGenerateBackup('quick', 'json')} 
            disabled={progress.isGenerating} 
            variant="outline" 
            className="w-full"
          >
            {progress.isGenerating && progress.stage.includes('Rápido') ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Configuración JSON
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Solo configuración y estadísticas básicas en formato JSON.
          </p>
        </div>
      </div>

      <BackupProgressDisplay progress={progress} />
    </div>
  );
};
