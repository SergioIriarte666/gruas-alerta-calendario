import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { safeDateToDisplay } from '@/utils/timezoneUtils';

const logger = createLogger('ResourceCompliance');

export interface ComplianceIssue {
  resource_type: 'crane' | 'operator';
  resource_id: string;
  resource_name: string;
  item: string;
  item_label: string;
  expiry_date: string | null;
  days_until: number | null;
  level: 'error' | 'warning';
}

const RESOURCE_LABELS: Record<ComplianceIssue['resource_type'], string> = {
  crane: 'Grúa',
  operator: 'Operador',
};

const bySeverity = (issue: ComplianceIssue) => (issue.level === 'error' ? 0 : 1);

export const formatComplianceIssueMessage = (
  issue: ComplianceIssue,
  { includeResourcePrefix = true }: { includeResourcePrefix?: boolean } = {},
) => {
  const prefix = includeResourcePrefix
    ? `${RESOURCE_LABELS[issue.resource_type]} ${issue.resource_name}: `
    : '';

  if (issue.item.startsWith('missing_')) {
    return `${prefix}${issue.item_label} sin documento registrado`;
  }

  if (!issue.expiry_date) {
    return `${prefix}${issue.item_label}`;
  }

  if ((issue.days_until ?? 0) < 0) {
    return `${prefix}${issue.item_label} venció el ${safeDateToDisplay(issue.expiry_date)} (fecha del servicio)`;
  }

  if (issue.days_until === 0) {
    return `${prefix}${issue.item_label} vence el día del servicio`;
  }

  if ((issue.days_until ?? 0) > 0) {
    return `${prefix}${issue.item_label} vence en ${issue.days_until} días (a la fecha del servicio)`;
  }

  return `${prefix}${issue.item_label}`;
};

export function useResourceCompliance(
  craneId?: string | null,
  operatorIds: string[] = [],
  serviceDate?: string | null,
) {
  const normalizedOperatorIds = useMemo(
    () =>
      [...new Set(operatorIds.filter((operatorId) => Boolean(operatorId?.trim())))]
        .sort((left, right) => left.localeCompare(right)),
    [operatorIds],
  );

  const query = useQuery({
    queryKey: ['resource-compliance', craneId ?? null, normalizedOperatorIds, serviceDate ?? null],
    staleTime: 2 * 60 * 1000,
    enabled: Boolean((craneId || normalizedOperatorIds.length) && serviceDate),
    queryFn: async (): Promise<ComplianceIssue[]> => {
      const { data, error } = await (supabase as any).rpc('get_resource_compliance', {
        p_crane_id: craneId || null,
        p_operator_ids: normalizedOperatorIds.length > 0 ? normalizedOperatorIds : null,
        p_service_date: serviceDate,
      });

      if (error) {
        logger.error('Error fetching resource compliance:', error);
        throw error;
      }

      return ((data ?? []) as ComplianceIssue[]).sort((left, right) => {
        const severityDelta = bySeverity(left) - bySeverity(right);
        if (severityDelta !== 0) return severityDelta;

        if (left.resource_type !== right.resource_type) {
          return left.resource_type.localeCompare(right.resource_type);
        }

        if (left.resource_name !== right.resource_name) {
          return left.resource_name.localeCompare(right.resource_name);
        }

        return left.item.localeCompare(right.item);
      });
    },
  });

  const issues = query.data ?? [];
  const blockingIssues = useMemo(
    () => issues.filter((issue) => issue.level === 'error'),
    [issues],
  );
  const warningIssues = useMemo(
    () => issues.filter((issue) => issue.level === 'warning'),
    [issues],
  );

  return {
    issues,
    blockingIssues,
    warningIssues,
    isLoading: query.isLoading || query.isFetching,
  };
}
