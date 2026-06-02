
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { BackupLog, BackupProgress, BackupResult } from '@/types/backup';
import { downloadTextFile } from '@/utils/fileDownload';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useBackupManager");
export const useBackupManager = () => {
  const [progress, setProgress] = useState<BackupProgress>({
    isGenerating: false,
    progress: 0,
    stage: 'idle'
  });
  const [lastGeneratedBackup, setLastGeneratedBackup] = useState<BackupResult | null>(null);

  // Obtener historial de respaldos
  const { data: backupLogs, refetch: refetchLogs, error } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('backup_logs')
          .select(`
            *,
            profiles!backup_logs_created_by_fkey(email, full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          logger.error('Error fetching backup logs:', error);
          throw error;
        }

        return data as (BackupLog & { profiles: { email: string; full_name: string } })[];
      } catch (error) {
        logger.error('Failed to fetch backup logs:', error);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 segundos
    retry: 1,
  });

  const generateBackup = useCallback(async (
    type: 'full' | 'quick' = 'full', 
    format: 'json' | 'sql' = 'json'
  ): Promise<BackupResult> => {
    const formatLabel = format === 'sql' ? 'SQL' : 'JSON';
    const typeLabel = type === 'full' ? 'completo' : 'rápido';
    
    setProgress({
      isGenerating: true,
      progress: 10,
      stage: `Iniciando respaldo ${typeLabel} (${formatLabel})...`
    });

    try {
      setProgress(prev => ({ 
        ...prev, 
        progress: 30, 
        stage: `Generando dump ${formatLabel}...` 
      }));

      const { data, error } = await supabase.functions.invoke('generate-backup', {
        body: { type, format }
      });

      if (error) {
        logger.error('Edge function error:', error);
        throw error;
      }

      setProgress(prev => ({ 
        ...prev, 
        progress: 80, 
        stage: 'Preparando descarga...' 
      }));

      if (!data || !data.success) {
        throw new Error(data?.error || 'Error generando respaldo');
      }

      setProgress(prev => ({ 
        ...prev, 
        progress: 100, 
        stage: `Respaldo ${formatLabel} generado exitosamente` 
      }));

      // Refrescar logs
      await refetchLogs();

      // Reset progress después de un momento
      setTimeout(() => {
        setProgress({
          isGenerating: false,
          progress: 0,
          stage: 'idle'
        });
      }, 2000);

      return {
        success: true,
        fileName: data.fileName,
        content: data.content,
        size: data.size,
        type: data.type,
        format: data.format
      };

    } catch (error: any) {
      logger.error('Error generating backup:', error);
      
      setProgress({
        isGenerating: false,
        progress: 0,
        stage: 'idle',
        error: error.message || 'Error interno del servidor'
      });

      // También refrescar logs en caso de error
      await refetchLogs();

      return {
        success: false,
        error: error.message || 'Error interno del servidor'
      };
    }
  }, [refetchLogs]);

  const downloadBackup = useCallback((content: string, fileName: string, contentType: string) => {
    try {
      downloadTextFile({ content, fileName, contentType });
      return true;
    } catch (error) {
      logger.error('Error downloading backup:', error);
      return false;
    }
  }, []);

  const generateAndDownloadBackup = useCallback(async (
    type: 'full' | 'quick' = 'full',
    format: 'json' | 'sql' = 'json'
  ) => {
    try {
      const result = await generateBackup(type, format);
      
      if (result.success && result.content && result.fileName && result.type) {
        setLastGeneratedBackup(result);
        const downloadStarted = downloadBackup(result.content, result.fileName, result.type);
        
        const formatLabel = format === 'sql' ? 'SQL' : 'JSON';
        const typeLabel = type === 'full' ? 'completo' : 'rápido';
        
        if (downloadStarted) {
          toast.success('Respaldo listo', {
            description: `Respaldo ${typeLabel} (${formatLabel}) generado. Si el navegador bloquea la descarga automática, use el botón “Descargar archivo”.`
          });
        } else {
          toast.error('Descarga no iniciada', {
            description: 'El archivo se generó, pero el navegador no inició la descarga automática. Use el botón “Descargar archivo”.'
          });
        }
      } else {
        toast.error('Error en respaldo', {
          description: result.error || 'No se pudo generar el respaldo.'
        });
      }
    } catch (error) {
      logger.error('Error in generateAndDownloadBackup:', error);
      toast.error('Error en respaldo', {
        description: 'Ocurrió un error inesperado al generar el respaldo.'
      });
    }
  }, [generateBackup, downloadBackup]);

  return {
    progress,
    lastGeneratedBackup,
    backupLogs,
    generateBackup,
    downloadBackup,
    generateAndDownloadBackup,
    refetchLogs,
    error
  };
};
