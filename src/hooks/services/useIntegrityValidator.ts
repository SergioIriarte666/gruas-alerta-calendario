import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';

const logger = createLogger('IntegrityValidator');

/**
 * VALIDACIÓN DE INTEGRIDAD DE COMISIONES
 *
 * El trigger de BD (sync_service_commissions) es la única fuente de verdad
 * para crear/anular comisiones. Este validador NO repara nada: solo reporta
 * los únicos problemas que el trigger no puede resolver solo y que requieren
 * revisión humana:
 *
 * - stale_pending_commission: comisión pendiente de pago para un servicio
 *   completado hace más de STALE_DAYS días (alerta de cobranza).
 * - duplicate_commission: dos o más filas pendientes para el mismo
 *   servicio + operador.
 * - orphan_commission: fila de comisión cuyo servicio ya no existe.
 *
 * Estados válidos del negocio (cancelados, operadores exentos, reasignaciones
 * históricas) NO son issues.
 */

const COMMISSION_CATEGORY_ID = '440296d4-09c2-4f3a-b02b-835f861df4c4';
const COMMISSION_ELIGIBLE_STATUSES = ['completed', 'with_purchase_order', 'invoiced'];
const STALE_DAYS = 30;

interface IntegrityIssue {
  id: string;
  serviceId: string | null;
  serviceFolio: string;
  issueType: 'stale_pending_commission' | 'duplicate_commission' | 'orphan_commission';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: any;
  canAutoRepair: false;
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
    stale_pending_commission: number;
    duplicate_commission: number;
    orphan_commission: number;
  };
  autoRepairableIssues: number;
  lastAuditTime: Date | null;
  systemHealthScore: number; // 0-100, ratio puro de servicios sin issues
}

const EMPTY_METRICS: IntegrityMetrics = {
  totalServices: 0,
  consistentServices: 0,
  inconsistentServices: 0,
  totalIssues: 0,
  issuesBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  issuesByType: { stale_pending_commission: 0, duplicate_commission: 0, orphan_commission: 0 },
  autoRepairableIssues: 0,
  lastAuditTime: null,
  systemHealthScore: 100,
};

interface CommissionRow {
  id: string;
  service_id: string | null;
  service_folio: string | null;
  operator_id: string | null;
  amount: number;
  date: string;
  payment_date: string | null;
  payment_batch_id: string | null;
  services: { id: string; status: string; folio: string } | null;
}

export const useIntegrityValidator = () => {
  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [metrics, setMetrics] = useState<IntegrityMetrics>(EMPTY_METRICS);

  /**
   * AUDITORÍA COMPLETA
   * Una sola pasada sobre las filas de comisión; clasificación en cliente.
   */
  const runFullAudit = useCallback(async (): Promise<IntegrityIssue[]> => {
    setValidating(true);
    logger.info('🔍 [INTEGRITY_AUDIT] Iniciando auditoría de comisiones');

    try {
      const { data, error } = await supabase
        .from('costs')
        .select(`
          id, service_id, service_folio, operator_id, amount, date,
          payment_date, payment_batch_id,
          services(id, status, folio)
        `)
        .eq('category_id', COMMISSION_CATEGORY_ID)
        .limit(10000);

      if (error) {
        logger.error('❌ [INTEGRITY_AUDIT] Error obteniendo comisiones:', error);
        throw error;
      }

      const rows = (data ?? []) as unknown as CommissionRow[];
      const detectedIssues: IntegrityIssue[] = [];
      const now = businessClock.todayDate();
      const staleCutoff = new Date(now);
      staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);

      const isPaid = (row: CommissionRow) => !!row.payment_date || !!row.payment_batch_id;

      // 1) Huérfanas: el servicio ya no existe
      for (const row of rows) {
        if (!row.service_id || !row.services) {
          detectedIssues.push({
            id: `${row.id}_orphan`,
            serviceId: row.service_id,
            serviceFolio: row.service_folio ?? 'Sin folio',
            issueType: 'orphan_commission',
            severity: 'high',
            description: `Comisión de $${row.amount} sin servicio asociado (servicio eliminado)`,
            details: { costId: row.id, amount: row.amount, date: row.date },
            canAutoRepair: false,
            detectedAt: now,
          });
        }
      }

      // 2) Duplicadas: dos o más filas PENDIENTES para mismo servicio + operador
      const pendingByKey = new Map<string, CommissionRow[]>();
      for (const row of rows) {
        if (isPaid(row) || !row.service_id || !row.operator_id) continue;
        const key = `${row.service_id}_${row.operator_id}`;
        pendingByKey.set(key, [...(pendingByKey.get(key) ?? []), row]);
      }
      for (const [key, group] of pendingByKey) {
        if (group.length > 1) {
          const first = group[0];
          detectedIssues.push({
            id: `${key}_duplicate`,
            serviceId: first.service_id,
            serviceFolio: first.services?.folio ?? first.service_folio ?? 'Sin folio',
            issueType: 'duplicate_commission',
            severity: 'high',
            description: `${group.length} comisiones pendientes para el mismo operador en el servicio`,
            details: { costIds: group.map((r) => r.id), amounts: group.map((r) => r.amount) },
            canAutoRepair: false,
            detectedAt: now,
          });
        }
      }

      // 3) Pendientes antiguas: alerta de cobranza, no de integridad
      for (const row of rows) {
        if (isPaid(row) || !row.services) continue;
        if (!COMMISSION_ELIGIBLE_STATUSES.includes(row.services.status)) continue;
        if (new Date(`${row.date}T12:00:00Z`) < staleCutoff) {
          detectedIssues.push({
            id: `${row.id}_stale`,
            serviceId: row.service_id,
            serviceFolio: row.services.folio,
            issueType: 'stale_pending_commission',
            severity: 'medium',
            description: `Comisión de $${row.amount} pendiente de pago desde ${row.date} (más de ${STALE_DAYS} días)`,
            details: { costId: row.id, amount: row.amount, date: row.date },
            canAutoRepair: false,
            detectedAt: now,
          });
        }
      }

      // Métricas: ratio puro de servicios con comisiones sin issues
      const auditedServices = new Set(rows.map((r) => r.service_id).filter(Boolean));
      const servicesWithIssues = new Set(
        detectedIssues.map((i) => i.serviceId).filter(Boolean)
      );
      const orphanIssues = detectedIssues.filter((i) => !i.serviceId).length;
      const totalServices = auditedServices.size;
      const inconsistentServices = servicesWithIssues.size;
      const consistentServices = totalServices - inconsistentServices;

      const issuesBySeverity = detectedIssues.reduce(
        (acc, issue) => {
          acc[issue.severity]++;
          return acc;
        },
        { low: 0, medium: 0, high: 0, critical: 0 },
      );

      const issuesByType = detectedIssues.reduce(
        (acc, issue) => {
          acc[issue.issueType]++;
          return acc;
        },
        { stale_pending_commission: 0, duplicate_commission: 0, orphan_commission: 0 },
      );

      const newMetrics: IntegrityMetrics = {
        totalServices,
        consistentServices,
        inconsistentServices,
        totalIssues: detectedIssues.length,
        issuesBySeverity,
        issuesByType,
        autoRepairableIssues: 0, // los issues reales requieren revisión humana
        lastAuditTime: businessClock.now(),
        systemHealthScore:
          totalServices > 0 ? Math.round((consistentServices / totalServices) * 100) : 100,
      };

      setMetrics(newMetrics);
      setIssues(detectedIssues);

      logger.info('🔍 [INTEGRITY_AUDIT] Auditoría completada', {
        commissionRows: rows.length,
        servicesAudited: totalServices,
        issuesFound: detectedIssues.length,
        orphanIssues,
        healthScore: newMetrics.systemHealthScore,
      });

      return detectedIssues;
    } catch (error) {
      logger.error('❌ [INTEGRITY_AUDIT] Error en auditoría:', error);
      throw error;
    } finally {
      setValidating(false);
    }
  }, []);

  /**
   * ALERTAS
   */
  const checkForAlerts = useCallback(() => {
    const alerts = [];

    if (metrics.systemHealthScore < 70) {
      alerts.push({
        type: 'health_degraded',
        severity: 'high',
        message: `Salud del sistema degradada: ${metrics.systemHealthScore}%`,
      });
    }

    if (metrics.issuesByType.duplicate_commission > 0) {
      alerts.push({
        type: 'duplicate_commissions',
        severity: 'high',
        message: `${metrics.issuesByType.duplicate_commission} comisiones duplicadas requieren revisión`,
      });
    }

    if (metrics.issuesByType.orphan_commission > 0) {
      alerts.push({
        type: 'orphan_commissions',
        severity: 'high',
        message: `${metrics.issuesByType.orphan_commission} comisiones huérfanas requieren revisión`,
      });
    }

    return alerts;
  }, [metrics]);

  /**
   * AUDITORÍA AUTOMÁTICA PERIÓDICA (solo lectura)
   */
  useEffect(() => {
    runFullAudit();

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

    // Acciones (solo lectura — la reparación de comisiones es del trigger de BD)
    runFullAudit,
    checkForAlerts,

    // Utilidades
    getIssuesByService: (serviceId: string) => issues.filter((issue) => issue.serviceId === serviceId),
    getIssuesBySeverity: (severity: IntegrityIssue['severity']) =>
      issues.filter((issue) => issue.severity === severity),
    getCriticalIssues: () =>
      issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high'),
    isHealthy: () => metrics.systemHealthScore >= 90,
  };
};
