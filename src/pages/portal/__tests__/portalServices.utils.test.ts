import { describe, expect, it } from 'vitest';
import { getPurchaseOrderPendingServices } from '../portalServices.utils';
import type { ClientService } from '@/hooks/portal/useClientServices';

const buildService = (overrides: Partial<ClientService>): ClientService => ({
  id: 'svc-1',
  folio: 'F-001',
  service_date: '2026-06-10',
  status: 'pending',
  origin: 'Origen',
  destination: 'Destino',
  value: 10000,
  crane_license_plate: 'AA-BB-11',
  operator_name: 'Operador',
  service_type_name: 'Traslado',
  vehicle_brand: '',
  vehicle_model: '',
  license_plate: '',
  purchase_order: null,
  purchase_order_number: null,
  quote_number: null,
  purchase_order_required: false,
  needs_purchase_order: false,
  is_portal_request: false,
  ...overrides,
});

describe('getPurchaseOrderPendingServices', () => {
  it('incluye solo servicios en estado cotizado', () => {
    const services = [
      buildService({ id: 'svc-quoted-1', status: 'quoted', folio: 'F-101' }),
      buildService({ id: 'svc-quoted-2', status: 'quoted', folio: 'F-102' }),
      buildService({ id: 'svc-po-pending', status: 'purchase_order_pending', folio: 'F-201' }),
      buildService({ id: 'svc-completed', status: 'completed', folio: 'F-301' }),
    ];

    const result = getPurchaseOrderPendingServices(services);

    expect(result).toHaveLength(2);
    expect(result.map((service) => service.id)).toEqual(['svc-quoted-1', 'svc-quoted-2']);
  });

  it('excluye servicios en otros estados del ciclo de vida', () => {
    const services = [
      buildService({ id: 'svc-pending', status: 'pending' }),
      buildService({ id: 'svc-in-progress', status: 'in_progress' }),
      buildService({ id: 'svc-completed', status: 'completed' }),
      buildService({ id: 'svc-purchase-order-pending', status: 'purchase_order_pending' }),
      buildService({ id: 'svc-with-po', status: 'with_purchase_order' }),
    ];

    const result = getPurchaseOrderPendingServices(services);

    expect(result).toEqual([]);
  });

  it('retorna lista vacia cuando no recibe servicios', () => {
    expect(getPurchaseOrderPendingServices()).toEqual([]);
    expect(getPurchaseOrderPendingServices([])).toEqual([]);
  });
});
