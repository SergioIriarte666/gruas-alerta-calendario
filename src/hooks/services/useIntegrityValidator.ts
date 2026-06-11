import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { useAdvancedServiceSync } from './useAdvancedServiceSync';

const logger = createLogger('IntegrityValidator');

/**
 * FASE 4: VALIDACIÓN DE INTEGRIDAD
 * 
 * Sistema de auditoría automática que detecta inconsistencias:
 * - Servicios con comisiones desincronizadas
 * - Campos legacy inconsistentes
 * - Comisiones huérfanas en costs table
 * - Service_resources sin costs correspondientes
 * 
 * Características:
 * ✅ Auditoría automática en intervalos regulares
 * ✅ Alertas cuando se detecten desincronizaciones
 * ✅ Herramientas de reparación automática
 * ✅ Dashboard de salud del sistema
 * ✅ Métricas de integridad en tiempo real
 */

interface IntegrityIssue {
  id: string;
  serviceId: string;
  serviceFolio: string;
  issueType: 'legacy_mismatch' | 'missing_commission' | 'orphan_commission' | 'amount_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: any;
  canAutoRepair: boolean;
  detectedAt: Date;
}

interface IntegrityMetrics {
  totalServices: number;
  consistentServices: number;
  inconsistentServices: number;
  totalIssues: number;
  issuesBySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  issuesByType: {
    legacy_mismatch: number;
    missing_commission: number;
    orphan_commission: number;
    amount_mismatch: number;
  };
  autoRepairableIssues: number;
  lastAuditTime: Date | null;
  systemHealthScore: number; // 0-100
}

export const useIntegrityValidator = () => {
  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [metrics, setMetrics] = useState<IntegrityMetrics>({
    totalServices: 0,
    consistentServices: 0,
    inconsistentServices: 0,
    totalIssues: 0,
    issuesBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    issuesByType: { legacy_mismatch: 0, missing_commission: 0, orphan_commission: 0, amount_mismatch: 0 },
    autoRepairableIssues: 0,
    lastAuditTime: null,
    systemHealthScore: 100
  });
  
  const { verifyConsistency, autoRepair } = useAdvancedServiceSync();

  /**
   * AUDITORÍA COMPLETA DEL SISTEMA
   * Analiza todos los servicios y detecta inconsistencias
   */
  const runFullAudit = useCallback(async (): Promise<IntegrityIssue[]> => {
    setValidating(true);
    logger.info('🔍 [INTEGRITY_AUDIT] Iniciando auditoría completa del sistema');

    try {
      const detectedIssues: IntegrityIssue[] = [];

      // Obtener todos los servicios con operadores/comisiones
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          id, folio, operator_id, operator_commission,
          service_resources!inner(operator_id, commission_amount, is_primary)
        `)
        .gt('operator_commission', 0) // Solo servicios con comisiones configuradas
        .neq('status', 'cancelled'); // Un cancelado sin comisión en costs no es un issue

      if (servicesError) {
        logger.error('❌ [INTEGRITY_AUDIT] Error obteniendo servicios:', servicesError);
        throw servicesError;
      }

      logger.info(`🔍 [INTEGRITY_AUDIT] Analizando ${services?.length || 0} servicios con comisiones`);

      // Analizar cada servicio
      for (const service of services || []) {
        try {
          const consistencyCheck = await verifyConsistency(service.id);
          
          if (!consistencyCheck.consistent) {
            // Analizar cada issue detectado
            for (const issue of consistencyCheck.issues) {
              let issueType: IntegrityIssue['issueType'] = 'legacy_mismatch';
              let severity: IntegrityIssue['severity'] = 'medium';
              
              // Clasificar tipo de issue
              if (issue.includes('operator_id no coincide')) {
                issueType = 'legacy_mismatch';
                severity = 'high';
              } else if (issue.includes('operator_commission no coincide')) {
                issueType = 'legacy_mismatch';
                severity = 'high';
              } else if (issue.includes('tiene comisión en service_resources pero no en costs')) {
                issueType = 'missing_commission';
                severity = 'critical';
              } else if (issue.includes('tiene comisión en costs pero no en service_resources')) {
                issueType = 'orphan_commission';
                severity = 'medium';
              } else if (issue.includes('Monto de comisión no coincide')) {
                issueType = 'amount_mismatch';
                severity = 'high';
              }

              // Clasificación real de auto-reparabilidad (la auditoría ya
              // excluye servicios cancelados):
              // - missing/amount: solo si el servicio no tiene comisiones pagadas
              // - orphan: nunca (puede ser comisión pagada históricamente; revisión manual)
              // - legacy_mismatch: nunca (reasignaciones históricas; revisión manual)
              const hasPaidCommission = !!consistencyCheck.details?.hasPaidCommission;
              let canAutoRepair = false;
              if (issueType === 'missing_commission' || issueType === 'amount_mismatch') {
                canAutoRepair = !hasPaidCommission;
              }

              const integrityIssue: IntegrityIssue = {
                id: `${service.id}_${issueType}_${Date.now()}`,
                serviceId: service.id,
                serviceFolio: service.folio,
                issueType,
                severity,
                description: issue,
                details: consistencyCheck.details,
                canAutoRepair,
                detectedAt: new Date()
              };

              detectedIssues.push(integrityIssue);
            }
          }
        } catch (error) {
          logger.error(`❌ [INTEGRITY_AUDIT] Error analizando servicio ${service.folio}:`, error);
          
          // Crear issue para error de análisis
          detectedIssues.push({
            id: `${service.id}_analysis_error_${Date.now()}`,
            serviceId: service.id,
            serviceFolio: service.folio,
            issueType: 'legacy_mismatch',
            severity: 'medium',
            description: `Error al analizar servicio: ${(error as Error).message}`,
            details: { error: (error as Error).message },
            canAutoRepair: false,
            detectedAt: new Date()
          });
        }
      }

      // Calcular métricas
      const newMetrics = calculateMetrics(services?.length || 0, detectedIssues);
      setMetrics(newMetrics);
      setIssues(detectedIssues);

      logger.info(`🔍 [INTEGRITY_AUDIT] Auditoría completada`, {
        servicesAnalyzed: services?.length || 0,
        issuesFound: detectedIssues.length,
        healthScore: newMetrics.systemHealthScore
      });

      return detectedIssues;

    } catch (error) {
      logger.error('❌ [INTEGRITY_AUDIT] Error en auditoría completa:', error);
      throw error;
    } finally {
      setValidating(false);
    }
  }, [verifyConsistency]);

  /**
   * CALCULAR MÉTRICAS DE INTEGRIDAD
   */
  const calculateMetrics = (totalServices: number, detectedIssues: IntegrityIssue[]): IntegrityMetrics => {
    const uniqueServices = new Set(detectedIssues.map(issue => issue.serviceId));
    const inconsistentServices = uniqueServices.size;
    const consistentServices = totalServices - inconsistentServices;

    const issuesBySeverity = detectedIssues.reduce((acc, issue) => {
      acc[issue.severity]++;
      return acc;
    }, { low: 0, medium: 0, high: 0, critical: 0 });

    const issuesByType = detectedIssues.reduce((acc, issue) => {
      acc[issue.issueType]++;
      return acc;
    }, { legacy_mismatch: 0, missing_commission: 0, orphan_commission: 0, amount_mismatch: 0 });

    const autoRepairableIssues = detectedIssues.filter(issue => issue.canAutoRepair).length;

    // Health score = ratio puro de servicios consistentes (0-100).
    // No restar penalizaciones por severidad: eso contaba el mismo estado dos
    // veces y colapsaba el score a 0% aunque el 90%+ estuviera sano. La
    // severidad se muestra como métricas separadas (issuesBySeverity).
    let healthScore = 100;
    if (totalServices > 0) {
      healthScore = Math.round((consistentServices / totalServices) * 100);
    }

    return {
      totalServices,
      consistentServices,
      inconsistentServices,
      totalIssues: detectedIssues.length,
      issuesBySeverity,
      issuesByType,
      autoRepairableIssues,
      lastAuditTime: new Date(),
      systemHealthScore: healthScore
    };
  };

  /**
   * REPARACIÓN AUTOMÁTICA DE TODOS LOS ISSUES
   */
  const autoRepairAllIssues = useCallback(async (): Promise<{
    repaired: number;
    failed: number;
    details: any[];
  }> => {
    logger.info('🔧 [INTEGRITY_REPAIR] Iniciando reparación automática de todos los issues');

    const repairableIssues = issues.filter(issue => issue.canAutoRepair);
    const uniqueServices = new Set(repairableIssues.map(issue => issue.serviceId));

    let repaired = 0;
    let failed = 0;
    const details: any[] = [];

    for (const serviceId of uniqueServices) {
      try {
        const repairResult = await autoRepair(serviceId);
        
        if (repairResult.repaired) {
          repaired++;
          details.push({
            serviceId,
            status: 'success',
            actions: repairResult.actions
          });
        } else {
          failed++;
          details.push({
            serviceId,
            status: 'failed',
            actions: repairResult.actions
          });
        }
      } catch (error) {
        failed++;
        details.push({
          serviceId,
          status: 'error',
          error: (error as Error).message
        });
      }
    }

    // Re-ejecutar auditoría después de reparaciones
    await runFullAudit();

    logger.info('🔧 [INTEGRITY_REPAIR] Reparación automática completada', {
      repaired,
      failed,
      totalProcessed: uniqueServices.size
    });

    return { repaired, failed, details };
  }, [issues, autoRepair, runFullAudit]);

  /**
   * ALERTAS AUTOMÁTICAS
   * Detecta cuando la salud del sistema está comprometida
   */
  const checkForAlerts = useCallback(() => {
    const alerts = [];

    if (metrics.systemHealthScore < 70) {
      alerts.push({
        type: 'health_degraded',
        severity: 'high',
        message: `Salud del sistema degradada: ${metrics.systemHealthScore}%`
      });
    }

    if (metrics.issuesBySeverity.critical > 0) {
      alerts.push({
        type: 'critical_issues',
        severity: 'critical',
        message: `${metrics.issuesBySeverity.critical} issues críticos detectados`
      });
    }

    if (metrics.inconsistentServices > metrics.totalServices * 0.1) { // >10% inconsistente
      alerts.push({
        type: 'high_inconsistency',
        severity: 'medium',
        message: `Alto nivel de inconsistencia: ${metrics.inconsistentServices}/${metrics.totalServices} servicios`
      });
    }

    return alerts;
  }, [metrics]);

  /**
   * AUDITORÍA AUTOMÁTICA PERIÓDICA
   */
  useEffect(() => {
    // Ejecutar auditoría inicial
    runFullAudit();

    // Configurar auditoría periódica cada 30 minutos
    const interval = setInterval(() => {
      logger.info('⏰ [INTEGRITY_AUDIT] Ejecutando auditoría periódica automática');
      runFullAudit();
    }, 30 * 60 * 1000); // 30 minutos

    return () => clearInterval(interval);
  }, [runFullAudit]);

  return {
    // Estado
    validating,
    issues,
    metrics,
    
    // Acciones
    runFullAudit,
    autoRepairAllIssues,
    checkForAlerts,
    
    // Utilidades
    getIssuesByService: (serviceId: string) => issues.filter(issue => issue.serviceId === serviceId),
    getIssuesBySeverity: (severity: IntegrityIssue['severity']) => issues.filter(issue => issue.severity === severity),
    getCriticalIssues: () => issues.filter(issue => issue.severity === 'critical'),
    isHealthy: () => metrics.systemHealthScore >= 90
  };
};