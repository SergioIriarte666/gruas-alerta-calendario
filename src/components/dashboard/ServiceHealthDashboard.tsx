import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
export const ServiceHealthDashboard = () => {
  const {
    validating,
    metrics,
    runFullAudit,
    autoRepairAllIssues,
    checkForAlerts,
    getCriticalIssues,
    isHealthy
  } = useIntegrityValidator();

  const [isRepairing, setIsRepairing] = useState(false);
  const [lastRepairResult, setLastRepairResult] = useState<any>(null);

  const alerts = checkForAlerts();
  const criticalIssues = getCriticalIssues();

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

  // Función para manejar reparación automática
  const handleAutoRepair = async () => {
    setIsRepairing(true);
    try {
      const result = await autoRepairAllIssues();
      setLastRepairResult(result);
    } catch (error) {
      console.error('Error en reparación automática:', error);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salud del Sistema</CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ultima Auditoria</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
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
              onClick={handleAutoRepair} 
              disabled={isRepairing || metrics.autoRepairableIssues === 0}
              variant="default"
            >
              {isRepairing ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <Zap className="mr-2 size-4" />
              )}
              Auto-Reparar ({metrics.autoRepairableIssues})
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
                      <div className="flex items-center space-x-2">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
