import { describe, expect, it } from 'vitest';
import type { Service } from '@/types';
import {
  parseBillingRowsFromMatrix,
  reconcileBillingBatch,
} from '@/utils/billingBatchImport';

const service = (id: string, folio: string, quote: string, value: number): Service => ({
  id,
  folio,
  requestDate: '2026-08-20',
  serviceDate: '2026-08-20',
  client: {
    id: 'client-1',
    name: 'Arrendadora',
    rut: '77.225.200-5',
    phone: '',
    email: '',
    address: '',
    department: 'General',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  quoteNumber: `COT-${quote}`,
  purchaseOrder: '',
  purchaseOrderNumber: '',
  vehicleBrand: '',
  vehicleModel: '',
  licensePlate: '',
  origin: '',
  destination: '',
  serviceType: {
    id: 'type-1',
    name: 'Remolque',
    description: '',
    basePrice: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  value,
  crane: null,
  operator: null,
  operatorCommission: 0,
  status: 'quoted',
  createdAt: '',
  updatedAt: '',
});

describe('billingBatchImport', () => {
  it('detecta encabezados después de filas de título y deriva vencimiento a 30 días', () => {
    const rows = parseBillingRowsFromMatrix([
      ['Consolidado de facturas'],
      [],
      ['N° Factura', 'N° Cotización', 'Fecha emisión', 'N° OC', 'Fecha OC', 'Neto', 'IVA', 'Total'],
      [4326, 4291, '2026-08-25T04:00:00.000Z', 4701761802, '2026-08-25T04:00:00.000Z', 60000, 11400, 71400],
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      invoiceNumber: '4326',
      quoteNumber: '4291',
      purchaseOrder: '4701761802',
      issueDate: '2026-08-25',
      dueDate: '2026-09-24',
      net: 60000,
    });
  });

  it('concilia cotizaciones repetidas y reparte servicios por monto de factura', () => {
    const rows = parseBillingRowsFromMatrix([
      ['Factura', 'Cotización', 'Fecha emisión', 'OC', 'Neto', 'IVA', 'Total'],
      [4326, 4291, '2026-08-25', 101, 60000, 11400, 71400],
      [4327, 4291, '2026-08-25', 102, 40000, 7600, 47600],
      [4328, 4291, '2026-08-25', 103, 160000, 30400, 190400],
    ]);
    const plan = reconcileBillingBatch({
      rows,
      services: [
        service('s1', 'SER-1', '4291', 40000),
        service('s2', 'SER-2', '4291', 160000),
        service('s3', 'SER-3', '4291', 60000),
      ],
      clientId: 'client-1',
    });

    expect(plan.ready).toBe(true);
    expect(plan.groups[0]).toMatchObject({
      status: 'ready',
      invoiceTotal: 260000,
      serviceTotal: 260000,
      difference: 0,
    });
    expect(plan.assignments.map((item) => [item.row.invoiceNumber, item.serviceTotal])).toEqual([
      ['4326', 60000],
      ['4327', 40000],
      ['4328', 160000],
    ]);
  });

  it('bloquea el lote cuando la suma de servicios no cuadra con las facturas', () => {
    const rows = parseBillingRowsFromMatrix([
      ['Factura', 'Cotización', 'Fecha emisión', 'OC', 'Neto', 'IVA', 'Total'],
      [4326, 4291, '2026-08-25', 101, 60000, 11400, 71400],
    ]);
    const plan = reconcileBillingBatch({
      rows,
      services: [service('s1', 'SER-1', '4291', 50000)],
      clientId: 'client-1',
    });

    expect(plan.ready).toBe(false);
    expect(plan.groups[0]).toMatchObject({ status: 'mismatch', difference: -10000 });
  });
});
