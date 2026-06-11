import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIntegrityValidator } from '@/hooks/services/useIntegrityValidator';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Zap,
  BarChart3,
  Settings,
  AlertCircle,
  Clock
} from 'lucide-react';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ServiceHealthDashboard");
/**
 * FASE 6: DASHBOARD DE MONITOREO CONTINUO
 * 
 * Dashboard de salud del sistema que muestra:
 * ✅ Métricas de integridad en tiempo real
 * ✅ Estado de sincronización de servicios
 * ✅ Issues detectados por severidad
 * ✅ Herramientas de reparación automática
 * ✅ Alertas y notificaciones
 * ✅ Histórico de operaciones
 */
const REPAIR_ACTION_LABELS: Record<string, string> = {
  missing_commission: 'Crear comisión pendiente desde service_resources',
  amount_mismatch: 'Recrear comisión no pagada con el monto correcto',
  legacy_mismatch: 'Sincronizar campos legacy del servicio',
  orphan_commission: 'Revisión manual requerida',
};

interface ManualRepairRun {
  executedAt: Date;
  repaired: number;
  failed: number;
}

export const ServiceHealthDashboard = () => {
  const {
    validating,
    issues,
    metrics,
    runFullAudit,
    autoRepairAllIssues,
    checkForAlerts,
    getCriticalIssues,
    isHealthy
  } = useIntegrityValidator();

  const [isRepairing, setIsRepairing] = useState(false);
  const [lastRepairResult, setLastRepairResult] = useState<any>(null);
  const [repairPreviewOpen, setRepairPreviewOpen] = useState(false);
  const [repairHistory, setRepairHistory] = useState<ManualRepairRun[]>([]);

  const alerts = checkForAlerts();
  const criticalIssues = getCriticalIssues();
  const repairableIssues = issues.filter(issue => issue.canAutoRepair);

  // Función para obtener color del health score
  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  // Función para obtener color de severidad
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  // Ejecuta la reparación tras la confirmación explícita del preview
  const handleConfirmedRepair = async () => {
    setRepairPreviewOpen(false);
    setIsRepairing(true);
    try {
      const result = await autoRepairAllIssues();
      setLastRepairResult(result);
      setRepairHistory(prev => [
        { executedAt: new Date(), repaired: result.repaired, failed: result.failed },
        ...prev,
      ]);
    } catch (error) {
      logger.error('Error en reparación automática:', error);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salud del Sistema</CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-x-2">
              <div className={`text-2xl font-bold ${getHealthColor(metrics.systemHealthScore)}`}>
                {metrics.systemHealthScore}%
              </div>
              {isHealthy() ? (
                <CheckCircle className="size-5 text-green-500" />
              ) : (
                <AlertTriangle className="size-5 text-red-500" />
              )}
            </div>
            <Progress 
              value={metrics.systemHealthScore} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Consistentes</CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.consistentServices}</div>
            <p className="text-xs text-muted-foreground">
              de {metrics.totalServices} servicios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues Críticos</CardTitle>
            <AlertCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {metrics.issuesBySeverity.critical}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.autoRepairableIssues} auto-reparables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ultima Auditoria</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-x-2">
              <span className="text-sm font-medium">
                {metrics.lastAuditTime
                  ? formatForDisplayWithTime(metrics.lastAuditTime)
                  : 'Pendiente'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {validating ? 'Auditoria en ejecucion' : 'Ultimo barrido completo de integridad'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas críticas */}
      {alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Alertas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-red-700">{alert.message}</span>
                  <Badge variant={getSeverityColor(alert.severity)}>
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Acciones del Sistema
          </CardTitle>
          <CardDescription>
            Herramientas para mantener la integridad del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={runFullAudit} 
              disabled={validating}
              variant="outline"
            >
              {validating ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 size-4" />
              )}
              Ejecutar Auditoría
            </Button>

            <Button
              onClick={() => setRepairPreviewOpen(true)}
              disabled={isRepairing || repairableIssues.length === 0}
              variant="default"
            >
              {isRepairing ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <Zap className="mr-2 size-4" />
              )}
              Auto-Reparar ({repairableIssues.length})
            </Button>

          </div>

          {lastRepairResult && (
            <div className="mt-4 p-3 border rounded-lg bg-gray-50">
              <p className="font-medium">Último resultado de reparación:</p>
              <p className="text-sm text-gray-600">
                Reparados: {lastRepairResult.repaired} | Fallidos: {lastRepairResult.failed}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs con detalles */}
      <Tabs defaultValue="issues" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="issues">Issues Detectados</TabsTrigger>
          <TabsTrigger value="metrics">Métricas Detalladas</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Issues por Severidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(metrics.issuesBySeverity).map(([severity, count]) => (
                  <div key={severity} className="text-center">
                    <div className={`text-2xl font-bold ${getSeverityColor(severity)}`}>
                      {count}
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {severity}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {criticalIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Issues Críticos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {criticalIssues.slice(0, 5).map((issue) => (
                    <div key={issue.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{issue.serviceFolio}</div>
                        <div className="text-sm text-gray-600">{issue.description}</div>
                        <div className="text-xs text-gray-500">
                          {formatForDisplayWithTime(issue.detectedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-x-2">
                        <Badge variant={getSeverityColor(issue.severity)}>
                          {issue.issueType}
                        </Badge>
                        {issue.canAutoRepair && (
                          <Badge variant="outline" className="text-green-600">
                            Auto-reparable
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(metrics.issuesByType).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estadísticas del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Servicios</span>
                    <span className="font-medium">{metrics.totalServices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Servicios Consistentes</span>
                    <span className="font-medium text-green-600">{metrics.consistentServices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Servicios Inconsistentes</span>
                    <span className="font-medium text-red-600">{metrics.inconsistentServices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Ratio de Consistencia</span>
                    <span className="font-medium">
                      {metrics.totalServices > 0 
                        ? Math.round((metrics.consistentServices / metrics.totalServices) * 100) 
                        : 100}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" />
                Historial de Auditorías
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Ultima auditoria completa</span>
                  <span className="font-medium">
                    {metrics.lastAuditTime ? formatForDisplayWithTime(metrics.lastAuditTime) : 'Nunca'}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Issues detectados en la ultima corrida</span>
                  <span className="font-medium">{metrics.totalIssues}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Servicios inconsistentes</span>
                  <span className="font-medium">{metrics.inconsistentServices}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Ultima reparacion automatica</span>
                  <span className="font-medium">
                    {lastRepairResult
                      ? `Reparados ${lastRepairResult.repaired} / Fallidos ${lastRepairResult.failed}`
                      : 'Sin ejecuciones manuales'}
                  </span>
                </div>

                {repairHistory.length > 0 && (
                  <div className="border-t border-border/60 pt-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">Ejecuciones manuales</p>
                    {repairHistory.map((run, index) => (
                      <div key={index} className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Ejecución manual — {formatForDisplayWithTime(run.executedAt)}
                        </span>
                        <span className="font-medium">
                          {run.repaired} reparados / {run.failed} fallidos
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview + confirmación de Auto-Reparar */}
      <AlertDialog open={repairPreviewOpen} onOpenChange={setRepairPreviewOpen}>
        <AlertDialogContent className="max-w-lg border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-warning" />
              Confirmar reparación automática
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se ejecutarán las siguientes {repairableIssues.length} reparaciones.
              Los issues no auto-reparables (históricos, con pagos) no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
            {repairableIssues.map((issue) => (
              <div key={issue.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{issue.serviceFolio}</span>
                  <p className="text-xs text-muted-foreground">
                    {REPAIR_ACTION_LABELS[issue.issueType] ?? 'Sincronización de comisiones'}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{issue.issueType}</Badge>
              </div>
            ))}
            {repairableIssues.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay reparaciones pendientes.</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedRepair} disabled={repairableIssues.length === 0}>
              Ejecutar {repairableIssues.length} reparaciones
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
