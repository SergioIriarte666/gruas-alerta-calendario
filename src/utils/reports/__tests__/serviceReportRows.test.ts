import { describe, expect, it } from 'vitest';
import { buildServiceReportAmounts, computeServiceReportTotals } from '../serviceReportRows';

// Datos tomados de produccion: los dos servicios con excedente que reportaron
// el descuadre entre pantalla (411.882) y exports (1.000.000).
const servicioConExcedente = {
  folio: '3262047-1',
  value: 1000000,
  hasExcess: true,
  clientCoveredAmount: 411882,
  excessAmount: 588118,
  thirdPartyClientId: '344f7485-5052-4430-b3a1-10ea8ea409e4',
  thirdPartyClient: { id: '344f7485-5052-4430-b3a1-10ea8ea409e4', name: 'El Pelícano Rent a Car SpA', rut: '' },
};

const segundoCaso = {
  folio: '3246613-1',
  value: 600000,
  hasExcess: true,
  clientCoveredAmount: 343051,
  excessAmount: 256949,
  thirdPartyClient: { id: '0d9095b0-8a90-408d-b3c4-ddd092744b9c', name: 'Centro de Ecologia Aplicada S.A.', rut: '' },
};

const sinExcedente = { folio: 'X-1', value: 250000, hasExcess: false };

describe('buildServiceReportAmounts', () => {
  it('informa cubierto, excedente y total del folio 3262047-1', () => {
    const amounts = buildServiceReportAmounts(servicioConExcedente);
    expect(amounts.covered).toBe(411882);
    expect(amounts.excess).toBe(588118);
    expect(amounts.total).toBe(1000000);
    expect(amounts.excessPayer).toBe('El Pelícano Rent a Car SpA');
  });

  it('informa el caso de control 3246613-1', () => {
    const amounts = buildServiceReportAmounts(segundoCaso);
    expect(amounts.covered).toBe(343051);
    expect(amounts.excess).toBe(256949);
    expect(amounts.total).toBe(600000);
    expect(amounts.excessPayer).toBe('Centro de Ecologia Aplicada S.A.');
  });

  it('sin excedente: cubierto = total y excedente 0', () => {
    const amounts = buildServiceReportAmounts(sinExcedente);
    expect(amounts.covered).toBe(250000);
    expect(amounts.excess).toBe(0);
    expect(amounts.total).toBe(250000);
    expect(amounts.excessPayer).toBe('');
  });

  it('con excedente pero sin tercero asignado, marca "Por definir"', () => {
    const amounts = buildServiceReportAmounts({
      value: 100000,
      hasExcess: true,
      clientCoveredAmount: 60000,
      excessAmount: 40000,
    });
    expect(amounts.excessPayer).toBe('Por definir');
  });

  it('tolera el objeto crudo de Supabase en snake_case', () => {
    const amounts = buildServiceReportAmounts({
      value: 1000000,
      has_excess: true,
      client_covered_amount: 411882,
      excess_amount: 588118,
    });
    expect(amounts.covered).toBe(411882);
    expect(amounts.excess).toBe(588118);
  });

  it('un arriendo de equipos no reporta cero: el monto vive en la custodia', () => {
    const amounts = buildServiceReportAmounts({
      value: 0,
      custodyTotalAmount: 480000,
      serviceType: { id: '', name: 'Arriendo de Equipos' },
    });
    expect(amounts.covered).toBe(480000);
    expect(amounts.total).toBe(480000);
    expect(amounts.excess).toBe(0);
  });
});

describe('computeServiceReportTotals', () => {
  it('los tres subtotales cuadran con la suma por servicio', () => {
    const totals = computeServiceReportTotals([servicioConExcedente, segundoCaso, sinExcedente]);
    expect(totals.totalCubierto).toBe(411882 + 343051 + 250000);
    expect(totals.totalExcedente).toBe(588118 + 256949);
    expect(totals.totalGeneral).toBe(1000000 + 600000 + 250000);
    expect(totals.totalCubierto + totals.totalExcedente).toBe(totals.totalGeneral);
  });
});
