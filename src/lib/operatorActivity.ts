import { businessClock } from '@/utils/businessClock';
import type { OperatorActivity, OperatorActivityEventType } from '@/types/operatorActivity';

export interface OperatorActivityGroup {
  key: string;
  label: string;
  items: OperatorActivity[];
}

export const getOperatorActivityDestination = (
  eventType: OperatorActivityEventType,
  serviceId: string | null,
): string | null => {
  if (!serviceId) return null;

  if (eventType === 'delivery_ready' || eventType === 'delivery_evidence_saved') {
    return `/operator/service/${serviceId}/inspection`;
  }
  if (eventType === 'service_started' || eventType === 'tracking_started' || eventType === 'tracking_stopped') {
    return '/operator?tab=activos';
  }
  if (eventType === 'service_completed') return '/operator?tab=completados';
  return '/operator';
};

export const formatOperatorActivityTime = (createdAt: string): string =>
  businessClock.format(createdAt, 'HH:mm');

export const groupOperatorActivities = (items: OperatorActivity[]): OperatorActivityGroup[] => {
  const today = businessClock.today();
  const yesterdayDate = businessClock.todayDate();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = businessClock.format(yesterdayDate, 'yyyy-MM-dd');
  const groups = new Map<string, OperatorActivityGroup>();

  for (const item of items) {
    const key = businessClock.format(item.created_at, 'yyyy-MM-dd');
    const label = key === today
      ? 'Hoy'
      : key === yesterday
        ? 'Ayer'
        : businessClock.format(item.created_at, 'dd/MM/yyyy');
    const current = groups.get(key) ?? { key, label, items: [] };
    current.items.push(item);
    groups.set(key, current);
  }

  return Array.from(groups.values());
};
