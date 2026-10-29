import { describe, expect, it } from 'vitest';
import { buildServiceTree } from '../useServicesPage';
import type { Service } from '@/types';

const svc = (over: Partial<Service> & { id: string; folio: string }): Service =>
  ({ value: 0, status: 'pending', ...over }) as Service;

const parent = svc({ id: 'p', folio: 'SRV-7122', isTripParent: true });
const c1 = svc({ id: 'c1', folio: 'SRV-7105', tripParentId: 'p', licensePlate: 'GHKG-23' });
const c2 = svc({ id: 'c2', folio: 'SRV-7106', tripParentId: 'p', licensePlate: 'DRBJ-52' });
const c3 = svc({ id: 'c3', folio: 'SRV-7107', tripParentId: 'p', licensePlate: 'HCHF-48' });
const normal = svc({ id: 'n', folio: 'SRV-7000' });
const all = [normal, c3, c1, parent, c2];

describe('buildServiceTree', () => {
  it('los hijos nunca son filas de primer nivel y van ordenados por folio bajo su padre', () => {
    const { rows, autoExpandedParentIds } = buildServiceTree([normal, parent, c1, c2, c3], all);
    expect(rows.map(r => r.folio)).toEqual(['SRV-7000', 'SRV-7122']);
    expect(rows[1].subRows?.map(c => c.folio)).toEqual(['SRV-7105', 'SRV-7106', 'SRV-7107']);
    // El padre calzó por sí mismo, pero también calzaron hijos: se auto-expande.
    expect(autoExpandedParentIds).toEqual(['p']);
  });

  it('un hijo que calza arrastra a su padre aunque el padre no calce, y el grupo queda auto-expandido', () => {
    const { rows, autoExpandedParentIds } = buildServiceTree([c2], all);
    expect(rows.map(r => r.folio)).toEqual(['SRV-7122']);
    expect(rows[0].subRows).toHaveLength(3);
    expect(autoExpandedParentIds).toEqual(['p']);
  });

  it('sin hijos calzando, el viaje queda colapsado', () => {
    const { autoExpandedParentIds } = buildServiceTree([parent, normal], all);
    expect(autoExpandedParentIds).toEqual([]);
  });

  it('el grupo ocupa la posición del primer miembro en el orden aplicado y no se duplica', () => {
    const { rows } = buildServiceTree([c3, normal, parent, c1], all);
    expect(rows.map(r => r.folio)).toEqual(['SRV-7122', 'SRV-7000']);
  });

  it('un hijo cuyo padre no está cargado no desaparece', () => {
    const orphan = svc({ id: 'o', folio: 'SRV-9000', tripParentId: 'missing' });
    const { rows } = buildServiceTree([orphan], [orphan]);
    expect(rows.map(r => r.folio)).toEqual(['SRV-9000']);
  });
});
