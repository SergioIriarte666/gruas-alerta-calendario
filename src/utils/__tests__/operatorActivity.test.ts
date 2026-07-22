import { describe, expect, it } from 'vitest';
import { getOperatorActivityDestination, groupOperatorActivities } from '@/lib/operatorActivity';
import { businessClock } from '@/utils/businessClock';
import type { OperatorActivity } from '@/types/operatorActivity';

const activity = (overrides: Partial<OperatorActivity> = {}): OperatorActivity => ({
  id: crypto.randomUUID(),
  operator_id: 'operator-1',
  service_id: 'service-1',
  event_type: 'service_assigned',
  severity: 'info',
  title: 'Servicio asignado',
  description: null,
  metadata: {},
  dedupe_key: null,
  created_at: businessClock.nowISO(),
  read_at: null,
  ...overrides,
});

describe('operatorActivity', () => {
  it('dirige cada evento al contexto operativo correcto', () => {
    expect(getOperatorActivityDestination('service_started', 'service-1')).toBe('/operator?tab=activos');
    expect(getOperatorActivityDestination('delivery_ready', 'service-1')).toBe('/operator/service/service-1/inspection');
    expect(getOperatorActivityDestination('service_completed', 'service-1')).toBe('/operator?tab=completados');
    expect(getOperatorActivityDestination('sync_completed', null)).toBeNull();
  });

  it('agrupa la cronología por día conservando el orden recibido', () => {
    const items = [
      activity({ id: 'a', title: 'Primera' }),
      activity({ id: 'b', title: 'Segunda' }),
    ];

    const groups = groupOperatorActivities(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Hoy');
    expect(groups[0].items.map((item) => item.id)).toEqual(['a', 'b']);
  });
});
