import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoricalResults } from '../HistoricalResults';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// Radix Select/Popover internals call scrollIntoView, no implementado en jsdom.
Element.prototype.scrollIntoView = vi.fn();

const today = new Date();
const thisYear = today.getFullYear();

const salesInvoices = [
  {
    id: 's1',
    clientId: 'c1',
    client: { id: 'c1', name: 'Cliente Sistema' },
    issueDate: `${thisYear}-01-15`,
    total: 100000,
    status: 'sent',
    source: 'sistema',
  },
  {
    id: 's2',
    clientId: 'c2',
    client: { id: 'c2', name: 'Cliente Historico' },
    issueDate: `${thisYear}-02-15`,
    total: 50000,
    status: 'sent',
    source: 'historico',
  },
];

let purchaseInvoices: any[] = [];

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => ({ invoices: salesInvoices, loading: false }),
}));

vi.mock('@/hooks/usePurchaseInvoices', () => ({
  usePurchaseInvoices: () => ({ invoices: purchaseInvoices, isLoading: false }),
}));

describe('HistoricalResults', () => {
  it('los KPIs reflejan el total de ventas del período filtrado (sin filtro de origen)', () => {
    purchaseInvoices = [];
    render(<HistoricalResults />);
    // 100.000 (sistema) + 50.000 (histórico) = 150.000, sin filtro de origen activo
    expect(screen.getAllByText('$150.000').length).toBeGreaterThan(0);
  });

  it('muestra estado vacío "sin registros" cuando no hay compras en absoluto', () => {
    purchaseInvoices = [];
    render(<HistoricalResults />);
    expect(
      screen.getAllByText(/Aún no hay registros\. Importa tu histórico para comenzar\./i).length
    ).toBeGreaterThan(0);
  });

  it('muestra estado vacío de "filtros" cuando hay compras pero ninguna cae en el período seleccionado', () => {
    purchaseInvoices = [
      {
        id: 'p1',
        supplier_id: 'sup1',
        supplier: { id: 'sup1', name: 'Proveedor X' },
        issue_date: `${thisYear - 5}-01-01`,
        amount: 10000,
        status: 'paid',
        source: 'sistema',
      },
    ];
    render(<HistoricalResults />);
    expect(
      screen.getAllByText(/No hay resultados para los filtros o el período seleccionados/i).length
    ).toBeGreaterThan(0);
  });
});
