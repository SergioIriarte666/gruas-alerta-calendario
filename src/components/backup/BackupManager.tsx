import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useBackupManager } from '@/hooks/useBackupManager';

interface BackupManagerProps {
  className?: string;
}

export const BackupManager = ({ className }: BackupManagerProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [repairData, setRepairData] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const { backupLogs } = useBackupManager();

  const generateSQLDump = async () => {
    try {
      setIsGenerating(true);
      setProgress(10);

      const { data, error } = await supabase.functions.invoke('generate-sql-dump', {
        body: {
          includeData: true,
          includeStructure: true,
          tables: [
            'services',
            'service_resources', 
            'costs',
            'operators',
            'cost_categories',
            'clients',
            'cranes',
            'service_types',
            'profiles'
          ]
        }
      });

      setProgress(50);

      if (error) throw error;

      if (data.success) {
        setProgress(80);
        
        // Crear archivo y descargarlo
        const blob = new Blob([data.sqlDump], { type: 'text/sql' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = data.metadata.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setProgress(100);

        toast.success(`Dump SQL Generado: ${data.metadata.fileName} (${Math.round(data.metadata.sizeBytes / 1024)} KB)`);
      }
    } catch (error: any) {
      console.error('Error generating SQL dump:', error);
      toast.error(error.message || "Error al generar dump SQL");
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const auditCommissionSystem = async () => {
    try {
      const { data, error } = await supabase.rpc('audit_commission_system');
      
      if (error) throw error;
      
      setAuditData(data);
      toast.success("Auditoría completada del sistema de comisiones");
    } catch (error: any) {
      console.error('Error in audit:', error);
      toast.error(error.message || "Error al ejecutar auditoría");
    }
  };

  const repairCommissionSystem = async () => {
    try {
      const { data, error } = await supabase.rpc('repair_commission_system');
      
      if (error) throw error;
      
      setRepairData(data);
      const repairInfo = data as any;
      toast.success(`Sistema reparado: ${repairInfo.commissions_created} comisiones creadas, ${repairInfo.services_synced} servicios sincronizados`);
      
      // Ejecutar nueva auditoría después de la reparación
      await auditCommissionSystem();
    } catch (error: any) {
      console.error('Error in repair:', error);
      toast.error(error.message || "Error al reparar sistema");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* PARTE 1: RESPALDO SQL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Respaldo SQL Completo
          </CardTitle>
          <CardDescription>
            Genera un dump SQL completo de todas las tablas relacionadas con comisiones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">
                Generando dump SQL... {progress}%
              </p>
            </div>
          )}
          
          <Button 
            onClick={generateSQLDump} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generar Dump SQL Completo
          </Button>

          {backupLogs && backupLogs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Respaldos Recientes</h4>
              <div className="space-y-1">
                {backupLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <span>{log.metadata?.fileName || 'Backup'}</span>
                    <Badge variant={log.status === 'completed' ? 'default' : 'destructive'}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PARTE 2: AUDITORÍA Y REPARACIÓN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Sistema de Comisiones
          </CardTitle>
          <CardDescription>
            Auditoría y reparación definitiva del sistema de comisiones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={auditCommissionSystem} variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Auditar Sistema
            </Button>
            
            <Button onClick={repairCommissionSystem} variant="destructive">
              <CheckCircle className="h-4 w-4 mr-2" />
              Reparar Sistema
            </Button>
          </div>

          {auditData && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium">Resultado de Auditoría</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium">Servicios</div>
                  <div>Total: {auditData.services.total}</div>
                  <div>Completados: {auditData.services.completed}</div>
                  <div>Con Operador: {auditData.services.with_operator_id}</div>
                  <div>Con Recursos: {auditData.services.with_resources}</div>
                </div>
                
                <div>
                  <div className="font-medium">Comisiones</div>
                  <div>Total: {auditData.commissions.total}</div>
                  <div>Pendientes: {auditData.commissions.pending}</div>
                  <div>Pagadas: {auditData.commissions.paid}</div>
                  <div className="text-red-600">Faltantes: {auditData.commissions.missing}</div>
                </div>
                
                <div>
                  <div className="font-medium">Problemas</div>
                  <div className="text-orange-600">
                    Sin Operador: {auditData.issues.services_without_operator_id}
                  </div>
                  <div className="text-red-600">
                    Huérfanas: {auditData.commissions.orphaned}
                  </div>
                </div>
                
                <div>
                  <div className="font-medium">Estado</div>
                  <Badge variant={auditData.commissions.missing > 0 ? 'destructive' : 'default'}>
                    {auditData.commissions.missing > 0 ? 'Requiere Reparación' : 'Correcto'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {repairData && (
            <div className="space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800">Reparación Completada</h4>
              <div className="text-sm text-green-700">
                <div>• {repairData.services_synced} servicios sincronizados</div>
                <div>• {repairData.commissions_created} comisiones creadas</div>
                <div>• Trigger actualizado: {repairData.trigger_updated ? 'Sí' : 'No'}</div>
                <div>• Total reparado: {repairData.total_repaired} elementos</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};