# Sistema de Gestión de Respaldos

Este documento describe la implementación completa del sistema de respaldos para bases de datos Supabase, incluyendo generación de dumps SQL, exportación JSON, historial de respaldos y validación de permisos.

## Descripción General

El sistema de respaldos proporciona:
- **Dump SQL Completo**: Genera un archivo `.sql` con todas las tablas y datos
- **Export JSON Completo**: Exporta todos los datos en formato JSON estructurado
- **Respaldo Rápido de Configuración**: Solo configuración esencial en JSON ligero
- **Historial de Respaldos**: Registro de todas las operaciones con estado y metadata
- **Validación de Permisos**: Solo administradores pueden generar respaldos

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    BackupManagementSection                       │
│  ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │
│  │ BackupStatus    │ │ BackupControls   │ │ BackupHistory    │  │
│  │ Section         │ │ Section          │ │ Section          │  │
│  └─────────────────┘ └──────────────────┘ └──────────────────┘  │
│           │                   │                    │             │
│           └───────────────────┼────────────────────┘             │
│                               ▼                                  │
│                      useBackupManager                            │
│                               │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │   Edge Function       │
                    │   generate-backup     │
                    │  ┌─────────────────┐  │
                    │  │ AuthValidator   │  │
                    │  │ BackupLogger    │  │
                    │  │ BackupGenerators│  │
                    │  └─────────────────┘  │
                    └───────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌──────────────┐      ┌──────────────────┐
            │ RPC: generate│      │ RPC: generate    │
            │ _database_   │      │ _quick_backup    │
            │ backup       │      │                  │
            └──────────────┘      └──────────────────┘
```

---

## 1. Componentes Frontend

### 1.1 BackupManagementSection (Orquestador Principal)

```tsx
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
```

---

### 1.2 BackupStatusSection (Estado del Sistema)

```tsx
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BackupLog } from '@/types/backup';

interface BackupStatusSectionProps {
  lastSuccessfulBackup?: BackupLog;
  hookError?: Error | null;
}

export const BackupStatusSection: React.FC<BackupStatusSectionProps> = ({
  lastSuccessfulBackup,
  hookError
}) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-black">Estado del Sistema</h4>
      
      {/* Error del hook */}
      {hookError && (
        <Alert variant="destructive" className="bg-white border-red-200">
          <XCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-700">
            Error al cargar datos de respaldos: {hookError.message}
          </AlertDescription>
        </Alert>
      )}

      {lastSuccessfulBackup ? (
        <Alert className="bg-white border-green-200">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <AlertDescription className="text-green-700">
            Último respaldo exitoso: {' '}
            {formatDistanceToNow(new Date(lastSuccessfulBackup.created_at), {
              addSuffix: true,
              locale: es
            })}
            {lastSuccessfulBackup.metadata?.fileName && (
              <span className="block text-xs mt-1 text-green-600">
                Archivo: {lastSuccessfulBackup.metadata.fileName}
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-white border-yellow-200">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <AlertDescription className="text-yellow-700">
            No se encontraron respaldos anteriores. Se recomienda generar un respaldo.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
```

---

### 1.3 BackupControlsSection (Controles Manuales)

```tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Database, FileJson, Settings, Loader2 } from 'lucide-react';
import { BackupProgressDisplay } from './BackupProgressDisplay';
import type { BackupProgress } from '@/types/backup';

interface BackupControlsSectionProps {
  progress: BackupProgress;
  onGenerateBackup: (type: 'full' | 'quick', format?: 'json' | 'sql') => Promise<void>;
}

export const BackupControlsSection: React.FC<BackupControlsSectionProps> = ({
  progress,
  onGenerateBackup
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-black">Generar Respaldo Manual</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Respaldo Completo */}
        <div className="space-y-3 p-4 border rounded-lg bg-gray-50 border-gray-200">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-tms-green" />
            <span className="font-medium text-black">Respaldo Completo</span>
          </div>
          <p className="text-xs text-gray-600">
            Exporta todas las tablas del sistema incluyendo servicios, clientes, 
            operadores, grúas, costos, facturas y configuración.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => onGenerateBackup('full', 'sql')}
              disabled={progress.isGenerating}
              size="sm"
              className="flex-1 bg-tms-green hover:bg-tms-green/90"
            >
              {progress.isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Dump SQL
            </Button>
            <Button
              onClick={() => onGenerateBackup('full', 'json')}
              disabled={progress.isGenerating}
              size="sm"
              variant="outline"
              className="flex-1 border-gray-300 text-black hover:bg-gray-100"
            >
              {progress.isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4 mr-2" />
              )}
              Export JSON
            </Button>
          </div>
        </div>

        {/* Respaldo Rápido */}
        <div className="space-y-3 p-4 border rounded-lg bg-gray-50 border-gray-200">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-black">Respaldo Rápido</span>
          </div>
          <p className="text-xs text-gray-600">
            Exporta solo la configuración esencial: datos de empresa, 
            ajustes del sistema y contadores de folios.
          </p>
          <Button
            onClick={() => onGenerateBackup('quick', 'json')}
            disabled={progress.isGenerating}
            size="sm"
            variant="outline"
            className="w-full border-gray-300 text-black hover:bg-gray-100"
          >
            {progress.isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Configuración JSON
          </Button>
        </div>
      </div>

      {/* Display de progreso */}
      <BackupProgressDisplay progress={progress} />
    </div>
  );
};
```

---

### 1.4 BackupProgressDisplay (Barra de Progreso)

```tsx
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle } from 'lucide-react';
import type { BackupProgress } from '@/types/backup';

interface BackupProgressDisplayProps {
  progress: BackupProgress;
}

export const BackupProgressDisplay: React.FC<BackupProgressDisplayProps> = ({ progress }) => {
  if (!progress.isGenerating && !progress.error) {
    return null;
  }

  return (
    <div className="space-y-2">
      {progress.isGenerating && (
        <div className="space-y-2 p-4 rounded-lg border bg-white border-gray-200" style={{ background: '#ffffff' }}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-black">{progress.stage}</span>
            <span className="text-gray-600">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="w-full h-2" />
        </div>
      )}

      {progress.error && (
        <Alert 
          className="border-red-200" 
          style={{ background: '#ffffff', color: '#000000', borderColor: '#fecaca' }}
        >
          <XCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-700" style={{ color: '#b91c1c' }}>
            Error: {progress.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
```

---

### 1.5 BackupHistorySection (Historial de Respaldos)

```tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Database, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BackupLog } from '@/types/backup';

interface BackupHistorySectionProps {
  backupLogs?: BackupLog[];
}

export const BackupHistorySection: React.FC<BackupHistorySectionProps> = ({ backupLogs }) => {
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completado</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Fallido</Badge>;
      default:
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">En progreso</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-black">Historial de Respaldos</h4>
      
      {backupLogs && backupLogs.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {backupLogs.slice(0, 10).map((log) => (
            <div 
              key={log.id} 
              className="flex items-center justify-between p-3 border rounded-lg bg-white border-gray-200"
              style={{ background: '#ffffff' }}
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(log.status)}
                <div>
                  <span className="text-sm font-medium text-black">
                    {log.backup_type === 'quick' ? 'Configuración' : 'Completo'}
                    {log.metadata?.format && ` (${log.metadata.format.toUpperCase()})`}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: es })}
                    {log.file_size_bytes && ` • ${formatFileSize(log.file_size_bytes)}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(log.status)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border rounded-lg border-dashed border-gray-300">
          <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No hay respaldos registrados</p>
        </div>
      )}
    </div>
  );
};
```

---

## 2. Hook Principal: useBackupManager

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BackupLog, BackupProgress, BackupResult } from '@/types/backup';

export const useBackupManager = () => {
  const [progress, setProgress] = useState<BackupProgress>({
    isGenerating: false,
    progress: 0,
    stage: ''
  });

  // Query para obtener logs de respaldos
  const { 
    data: backupLogs, 
    error, 
    refetch: refetchLogs 
  } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_logs')
        .select(`
          *,
          profiles:created_by (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as BackupLog[];
    }
  });

  // Generar respaldo llamando a Edge Function
  const generateBackup = async (
    type: 'full' | 'quick' = 'full',
    format: 'json' | 'sql' = 'json'
  ): Promise<BackupResult> => {
    setProgress({
      isGenerating: true,
      progress: 10,
      stage: 'Iniciando generación de respaldo...'
    });

    try {
      setProgress(prev => ({ ...prev, progress: 30, stage: 'Conectando con el servidor...' }));

      const { data, error } = await supabase.functions.invoke('generate-backup', {
        body: { type, format }
      });

      if (error) {
        throw new Error(error.message || 'Error al generar respaldo');
      }

      setProgress(prev => ({ ...prev, progress: 80, stage: 'Procesando respaldo...' }));

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      setProgress({
        isGenerating: false,
        progress: 100,
        stage: 'Respaldo completado'
      });

      refetchLogs();
      return data;

    } catch (err: any) {
      const errorMessage = err.message || 'Error al generar respaldo';
      setProgress({
        isGenerating: false,
        progress: 0,
        stage: '',
        error: errorMessage
      });
      throw err;
    }
  };

  // Descargar archivo de respaldo
  const downloadBackup = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Combinar generación y descarga
  const generateAndDownloadBackup = async (
    type: 'full' | 'quick' = 'full',
    format: 'json' | 'sql' = 'json'
  ) => {
    try {
      toast.info('Generando respaldo...', { duration: 2000 });
      
      const result = await generateBackup(type, format);
      
      if (result.success && result.content && result.fileName) {
        const contentType = format === 'sql' 
          ? 'application/sql' 
          : 'application/json';
        
        downloadBackup(result.content, result.fileName, contentType);
        
        toast.success('Respaldo descargado exitosamente', {
          description: `Archivo: ${result.fileName}`
        });
      }
    } catch (err: any) {
      toast.error('Error al generar respaldo', {
        description: err.message
      });
    }
  };

  return {
    progress,
    backupLogs,
    generateBackup,
    downloadBackup,
    generateAndDownloadBackup,
    refetchLogs,
    error
  };
};
```

---

## 3. Tipos TypeScript

```typescript
// src/types/backup.ts

export interface BackupLog {
  id: string;
  created_at: string;
  created_by: string;
  backup_type: 'full' | 'quick' | 'auto' | 'full_sql' | 'full_json' | 'quick_json';
  status: 'started' | 'completed' | 'failed';
  file_size_bytes?: number;
  error_message?: string;
  metadata?: {
    fileName?: string;
    contentType?: string;
    format?: 'json' | 'sql';
    records_count?: string | number;
  };
}

export interface BackupProgress {
  isGenerating: boolean;
  progress: number;
  stage: string;
  error?: string;
}

export interface BackupResult {
  success: boolean;
  fileName?: string;
  content?: string;
  size?: number;
  type?: string;
  format?: 'json' | 'sql';
  error?: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  lastAutoBackup?: string;
  backupRetentionDays: number;
  preferredFormat: 'json' | 'sql';
  scheduledBackupTime: string;
}
```

---

## 4. Edge Function: generate-backup

### 4.1 Punto de Entrada (index.ts)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AuthValidator } from './authValidator.ts'
import { BackupLogger } from './backupLogger.ts'
import { BackupGenerators } from './backupGenerators.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! }
      }
    });

    // Validate authentication
    const authValidator = new AuthValidator(supabase);
    const { user } = await authValidator.validateRequest(
      req.headers.get('Authorization')
    );

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const type = body.type || 'full';
    const format = body.format || 'json';

    console.log(`Generating ${type} backup in ${format} format for user ${user.email}`);

    // Initialize logger and generators
    const logger = new BackupLogger(supabase);
    const generators = new BackupGenerators(supabase);

    // Create log entry
    const backupType = `${type}_${format}`;
    const logId = await logger.startLog(backupType, user.id);

    try {
      let result;

      // Generate backup based on type and format
      if (type === 'quick') {
        result = await generators.generateQuickBackup(user.email);
      } else if (format === 'sql') {
        result = await generators.generateSQLBackup(user.email);
      } else {
        result = await generators.generateFullBackup(user.email);
      }

      // Update log with success
      if (logId) {
        await logger.completeLog(logId, result.size, {
          fileName: result.fileName,
          contentType: result.contentType,
          format: format
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          fileName: result.fileName,
          content: result.content,
          size: result.size,
          type: type,
          format: format
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (genError: any) {
      // Log failure
      if (logId) {
        await logger.failLog(logId, genError.message);
      }
      throw genError;
    }

  } catch (error: any) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error al generar respaldo' 
      }),
      { 
        status: error.message?.includes('autenticado') || error.message?.includes('administrador') 
          ? 401 
          : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

---

### 4.2 Validador de Autenticación (authValidator.ts)

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthResult {
  user: any;
  isAdmin: boolean;
}

export class AuthValidator {
  constructor(private supabase: SupabaseClient) {}

  async validateRequest(authHeader: string | null): Promise<AuthResult> {
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await this.supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Usuario no autenticado');
    }

    // Verify user is admin
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Solo los administradores pueden generar respaldos');
    }

    return {
      user,
      isAdmin: true
    };
  }
}
```

---

### 4.3 Logger de Respaldos (backupLogger.ts)

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface BackupLog {
  id?: string;
  backup_type: string;
  status: 'started' | 'completed' | 'failed';
  created_by: string;
  file_size_bytes?: number;
  metadata?: any;
  error_message?: string;
}

export class BackupLogger {
  constructor(private supabase: SupabaseClient) {}

  async startLog(backupType: string, userId: string): Promise<string | null> {
    try {
      const { data: logData, error: logError } = await this.supabase
        .from('backup_logs')
        .insert({
          backup_type: backupType,
          status: 'started',
          created_by: userId
        })
        .select()
        .single();

      if (logError) {
        console.error('Error creating backup log:', logError);
        return null;
      }

      return logData?.id || null;
    } catch (error) {
      console.error('Exception creating backup log:', error);
      return null;
    }
  }

  async completeLog(logId: string, fileSize: number, metadata: any): Promise<void> {
    try {
      const { error: updateError } = await this.supabase
        .from('backup_logs')
        .update({
          status: 'completed',
          file_size_bytes: fileSize,
          metadata
        })
        .eq('id', logId);

      if (updateError) {
        console.error('Error updating backup log:', updateError);
      }
    } catch (error) {
      console.error('Exception updating backup log:', error);
    }
  }

  async failLog(logId: string, errorMessage: string): Promise<void> {
    try {
      const { error: updateError } = await this.supabase
        .from('backup_logs')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', logId);

      if (updateError) {
        console.error('Error updating backup log with error:', updateError);
      }
    } catch (error) {
      console.error('Exception updating backup log with error:', error);
    }
  }
}
```

---

### 4.4 Generadores de Respaldo (backupGenerators.ts)

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface BackupResult {
  content: string;
  fileName: string;
  contentType: string;
  size: number;
}

export class BackupGenerators {
  constructor(private supabase: SupabaseClient) {}

  async generateQuickBackup(userEmail: string): Promise<BackupResult> {
    console.log('Generating quick backup...');
    
    const { data, error } = await this.supabase.rpc('generate_quick_backup');
    
    if (error) {
      console.error('Error generating quick backup:', error);
      throw new Error(`Error al generar respaldo rápido: ${error.message}`);
    }

    const content = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup-config-${timestamp}.json`;

    return {
      content,
      fileName,
      contentType: 'application/json',
      size: new TextEncoder().encode(content).length
    };
  }

  async generateFullBackup(userEmail: string): Promise<BackupResult> {
    console.log('Generating full JSON backup...');
    
    const tables = [
      'company_data',
      'profiles',
      'clients',
      'operators',
      'cranes',
      'services',
      'costs',
      'cost_categories',
      'invoices',
      'commissions',
      'payment_terms',
      'income_categories',
      'incomes'
    ];

    const backupData: any = {
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: userEmail,
        type: 'full',
        format: 'json',
        version: '1.0'
      },
      data: {}
    };

    for (const table of tables) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('*');
        
        if (!error && data) {
          backupData.data[table] = data;
        }
      } catch (e) {
        console.warn(`Could not backup table ${table}:`, e);
      }
    }

    const content = JSON.stringify(backupData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup-full-${timestamp}.json`;

    return {
      content,
      fileName,
      contentType: 'application/json',
      size: new TextEncoder().encode(content).length
    };
  }

  async generateSQLBackup(userEmail: string): Promise<BackupResult> {
    console.log('Generating SQL backup...');
    
    const { data, error } = await this.supabase.rpc('generate_database_backup');
    
    if (error) {
      console.error('Error generating SQL backup:', error);
      throw new Error(`Error al generar dump SQL: ${error.message}`);
    }

    const content = data as string;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup-dump-${timestamp}.sql`;

    return {
      content,
      fileName,
      contentType: 'application/sql',
      size: new TextEncoder().encode(content).length
    };
  }
}
```

---

## 5. Funciones SQL (RPC)

### 5.1 generate_database_backup

```sql
CREATE OR REPLACE FUNCTION generate_database_backup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    backup_sql TEXT := '';
    table_name TEXT;
    table_data RECORD;
    column_names TEXT;
    column_values TEXT;
    tables_in_order TEXT[] := ARRAY[
        'company_data',
        'profiles',
        'clients',
        'operators',
        'cranes',
        'cost_categories',
        'cost_subcategories',
        'payment_terms',
        'income_categories',
        'services',
        'costs',
        'invoices',
        'invoice_services',
        'commissions',
        'incomes',
        'backup_logs'
    ];
BEGIN
    -- Header
    backup_sql := '-- TMS Database Backup' || E'\n';
    backup_sql := backup_sql || '-- Generated: ' || NOW()::TEXT || E'\n';
    backup_sql := backup_sql || '-- Format: SQL INSERT statements' || E'\n';
    backup_sql := backup_sql || E'\n';
    backup_sql := backup_sql || 'BEGIN;' || E'\n\n';

    -- Iterate tables in dependency order
    FOREACH table_name IN ARRAY tables_in_order
    LOOP
        backup_sql := backup_sql || '-- Table: ' || table_name || E'\n';
        
        FOR table_data IN EXECUTE format(
            'SELECT row_to_json(t) as row_data FROM %I t', 
            table_name
        )
        LOOP
            -- Build INSERT statement from JSON
            SELECT 
                string_agg(key, ', '),
                string_agg(
                    CASE 
                        WHEN value IS NULL THEN 'NULL'
                        WHEN jsonb_typeof(value) = 'string' THEN quote_literal(value#>>'{}')
                        ELSE value::TEXT
                    END, 
                    ', '
                )
            INTO column_names, column_values
            FROM jsonb_each(table_data.row_data::jsonb);
            
            IF column_names IS NOT NULL THEN
                backup_sql := backup_sql || format(
                    'INSERT INTO %I (%s) VALUES (%s);',
                    table_name,
                    column_names,
                    column_values
                ) || E'\n';
            END IF;
        END LOOP;
        
        backup_sql := backup_sql || E'\n';
    END LOOP;

    backup_sql := backup_sql || 'COMMIT;' || E'\n';
    backup_sql := backup_sql || '-- End of backup' || E'\n';

    RETURN backup_sql;
END;
$$;
```

---

### 5.2 generate_quick_backup

```sql
CREATE OR REPLACE FUNCTION generate_quick_backup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'metadata', jsonb_build_object(
            'generated_at', NOW(),
            'type', 'quick',
            'version', '1.0'
        ),
        'company_data', (SELECT row_to_json(cd) FROM company_data cd LIMIT 1),
        'table_counts', jsonb_build_object(
            'clients', (SELECT COUNT(*) FROM clients),
            'services', (SELECT COUNT(*) FROM services),
            'operators', (SELECT COUNT(*) FROM operators),
            'cranes', (SELECT COUNT(*) FROM cranes),
            'costs', (SELECT COUNT(*) FROM costs),
            'invoices', (SELECT COUNT(*) FROM invoices),
            'commissions', (SELECT COUNT(*) FROM commissions)
        ),
        'folio_counters', jsonb_build_object(
            'next_service_folio', (SELECT next_service_folio_number FROM company_data LIMIT 1),
            'next_invoice_folio', (SELECT next_invoice_folio_number FROM company_data LIMIT 1),
            'next_excess_folio', (SELECT next_excess_folio_number FROM company_data LIMIT 1)
        )
    ) INTO result;
    
    RETURN result;
END;
$$;
```

---

## 6. Esquema de Base de Datos

### 6.1 Tabla backup_logs

```sql
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES profiles(id),
    backup_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    file_size_bytes BIGINT,
    error_message TEXT,
    metadata JSONB
);

-- Índices
CREATE INDEX idx_backup_logs_created_at ON backup_logs(created_at DESC);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_created_by ON backup_logs(created_by);

-- Row Level Security
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver y crear logs de respaldo
CREATE POLICY "Only admins can view backup logs" ON backup_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Only admins can create backup logs" ON backup_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Only admins can update backup logs" ON backup_logs
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );
```

---

## 7. Dependencias

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.56.2",
    "@supabase/supabase-js": "^2.50.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.462.0",
    "sonner": "^1.5.0"
  }
}
```

---

## 8. Estructura de Archivos

```
src/
├── components/
│   └── settings/
│       ├── BackupManagementSection.tsx    # Orquestador principal
│       └── backup/
│           ├── BackupStatusSection.tsx     # Estado del sistema
│           ├── BackupControlsSection.tsx   # Botones de generación
│           ├── BackupProgressDisplay.tsx   # Barra de progreso
│           └── BackupHistorySection.tsx    # Historial de respaldos
├── hooks/
│   └── useBackupManager.ts                 # Hook principal
└── types/
    └── backup.ts                           # Interfaces TypeScript

supabase/
├── functions/
│   └── generate-backup/
│       ├── index.ts                        # Punto de entrada
│       ├── authValidator.ts                # Validación de permisos
│       ├── backupLogger.ts                 # Registro de operaciones
│       └── backupGenerators.ts             # Generadores SQL/JSON
└── migrations/
    └── XXXXXX_create_backup_system.sql     # Tabla y funciones RPC
```

---

## 9. Configuración de Edge Function (config.toml)

```toml
[functions.generate-backup]
verify_jwt = false
```

---

## 10. Estilos y UX

### Colores y Estilos
- Fondo blanco forzado: `style={{ background: '#ffffff' }}`
- Color primario: `text-tms-green`, `bg-tms-green`
- Estados de éxito: `border-green-200`, `text-green-700`
- Estados de advertencia: `border-yellow-200`, `text-yellow-700`
- Estados de error: `border-red-200`, `text-red-700`
- Estados informativos: `border-blue-200`, `text-blue-700`

### Iconos (Lucide)
- `Database` - Respaldo general
- `CheckCircle` - Éxito
- `XCircle` - Error
- `AlertTriangle` - Advertencia
- `Clock` - En progreso
- `RefreshCw` - Actualizar
- `FileJson` - Formato JSON
- `Settings` - Configuración
- `Loader2` - Cargando (con `animate-spin`)

### Formateo
- Tiempos relativos con `date-fns` en español
- Tamaños de archivo: Bytes → KB → MB → GB
- Nombres de archivo: `backup-{tipo}-{timestamp}.{ext}`

---

## 11. Integración en Settings Page

```tsx
// En tu página de configuración
import { BackupManagementSection } from '@/components/settings/BackupManagementSection';

export const SettingsPage = () => {
  return (
    <div className="space-y-6">
      {/* Otras secciones de configuración */}
      
      <BackupManagementSection />
    </div>
  );
};
```

---

## 12. Buenas Prácticas

1. **Validación de Permisos**: Solo administradores pueden generar respaldos
2. **Logging Completo**: Cada operación se registra con estado y metadata
3. **Manejo de Errores**: Captura y muestra errores de forma amigable
4. **Descarga Automática**: El archivo se descarga inmediatamente al completar
5. **Feedback Visual**: Progreso en tiempo real durante la generación
6. **Historial Auditable**: Registro de quién y cuándo generó cada respaldo
7. **Formatos Múltiples**: SQL para restauración, JSON para portabilidad
8. **Respaldo Rápido**: Opción ligera para configuración esencial

---

## 13. Notas de Implementación

- La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` para acceso completo
- Los dumps SQL están ordenados por dependencias de foreign keys
- El respaldo rápido incluye contadores de folios para continuidad
- Los logs se actualizan a "failed" automáticamente si hay error
- El sistema soporta extensión para respaldos automáticos programados
