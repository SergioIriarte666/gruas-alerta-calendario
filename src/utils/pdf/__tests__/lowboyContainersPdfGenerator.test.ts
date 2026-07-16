import { describe, expect, it } from 'vitest';
import type { LowboyContainerRow } from '@/types/lowboyContainers';
import { summarizeLowboyContainers } from '@/utils/pdf/lowboyContainersPdfGenerator';

const container = (overrides: Partial<LowboyContainerRow>): LowboyContainerRow => ({
  id: 'container-1',
  serial_number: 'TEST-001',
  size: '20',
  container_type: 'dry',
  condition: 'usado',
  status: 'disponible',
  acquisition_date: '2026-07-01',
  supplier_rut: null,
  supplier_name: 'Proveedor',
  acquisition_net_cost: 1_000_000,
  purchase_rcv_record_id: null,
  sale_id: null,
  sale_net_price: null,
  notes: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  costs: [],
  sale: null,
  purchase_rcv: null,
  ...overrides,
});

describe('summarizeLowboyContainers', () => {
  it('calcula estados, costos, ventas y margen del listado exportado', () => {
    const summary = summarizeLowboyContainers([
      container({ status: 'disponible', costs: [{ net_amount: 100_000 } as LowboyContainerRow['costs'][number]] }),
      container({ id: 'container-2', status: 'reservado', acquisition_net_cost: 800_000 }),
      container({ id: 'container-3', status: 'vendido', acquisition_net_cost: 1_500_000, sale_net_price: 2_000_000 }),
    ]);

    expect(summary).toEqual({
      available: 1,
      reserved: 1,
      sold: 1,
      totalCost: 3_400_000,
      saleNet: 2_000_000,
      margin: 500_000,
    });
  });
});
