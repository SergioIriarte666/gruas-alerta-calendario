
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { BackupLog, BackupProgress, BackupResult } from '@/types/backup';

export const useBackupManager = () => {
  const [progress, setProgress] = useState<BackupProgress>({
    isGenerating: false,
    progress: 0,
    stage: 'idle'
  });

  // Obtener historial de respaldos
  const { data: backupLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_logs')
        .select(`
          *,
          profiles!backup_logs_created_by_fkey(email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as (BackupLog & { profiles: { email: string; full_name: string } })[];
    },
    staleTime: 30 * 1000, // 30 segundos
  });

  const generateBackup = useCallback(async (type: 'full' | 'quick' = 'full'): Promise<BackupResult> => {
    setProgress({
      isGenerating: true,
      progress: 10,
      stage: 'Iniciando generación de respaldo...'
    });

    try {
      setProgress(prev => ({ ...prev, progress: 30, stage: 'Conectando con servidor...' }));

      const { data, error } = await supabase.functions.invoke('generate-backup', {
        body: { type }
      });

      if (error) throw error;

      setProgress(prev => ({ ...prev, progress: 80, stage: 'Preparando descarga...' }));

      if (!data.success) {
        throw new Error(data.error || 'Error generando respaldo');
      }

      setProgress(prev => ({ ...prev, progress: 100, stage: 'Respaldo generado exitosamente' }));

      // Refrescar logs
      refetchLogs();

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
        type: data.type
      };

    } catch (error: any) {
      console.error('Error generating backup:', error);
      
      setProgress({
        isGenerating: false,
        progress: 0,
        stage: 'idle',
        error: error.message
      });

      refetchLogs();

      return {
        success: false,
        error: error.message || 'Error interno del servidor'
      };
    }
  }, [refetchLogs]);

  const downloadBackup = useCallback((content: string, fileName: string, contentType: string) => {
    try {
      const blob = new Blob([content], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Respaldo descargado', {
        description: `Archivo ${fileName} descargado exitosamente.`
      });
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast.error('Error en descarga', {
        description: 'No se pudo descargar el archivo de respaldo.'
      });
    }
  }, []);

  const generateAndDownloadBackup = useCallback(async (type: 'full' | 'quick' = 'full') => {
    const result = await generateBackup(type);
    
    if (result.success && result.content && result.fileName && result.type) {
      downloadBackup(result.content, result.fileName, result.type);
      
      toast.success('Respaldo generado', {
        description: `Respaldo ${type === 'full' ? 'completo' : 'rápido'} generado y descargado exitosamente.`
      });
    } else {
      toast.error('Error en respaldo', {
        description: result.error || 'No se pudo generar el respaldo.'
      });
    }
  }, [generateBackup, downloadBackup]);

  return {
    progress,
    backupLogs,
    generateBackup,
    downloadBackup,
    generateAndDownloadBackup,
    refetchLogs
  };
};
