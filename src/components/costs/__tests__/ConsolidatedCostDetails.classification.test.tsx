import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsolidatedCostDetails } from '../ConsolidatedCostDetails';
import type { Cost } from '@/types/costs';

const invoice = vi.hoisted(() => ({
  id: 'invoice-1', invoice_number: '7069653', issue_date: '2026-10-17', due_date: '2026-10-17',
  amount: 223040, net_amount: 187429, tax_amount: 35611, status: 'pending', source_module: 'inventory_xml',
  items: [
    { id: 'line-1', product_code: 'SPYFRE0015', description: 'Patín', quantity: 4, unit_price: 43269, subtotal: 173076, tax_amount: 32884.44, total_amount: 205960.44, cost_subcategory: 'Partes y Piezas' },
    { id: 'line-2', product_code: 'EVEEVE0001', description: 'Pilas', quantity: 1, unit_price: 1756, subtotal: 1756, tax_amount: 333.64, total_amount: 2089.64, cost_subcategory: 'Consumibles' },
    { id: 'line-3', product_code: 'HERMED0002', description: 'Probador', quantity: 1, unit_price: 12597, subtotal: 12597, tax_amount: 2393.43, total_amount: 14990.43, cost_subcategory: 'Herramientas' },
  ],
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: invoice }) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ settings: {} }) }));
vi.mock('@/hooks/useChangeHistory', () => ({ useCostChangeHistory: () => ({ data: [], isLoading: false }) }));
vi.mock('@/components/ui/custom-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/utils/pdf/costDetailPdfGenerator', () => ({ generateCostDetailPDF: vi.fn() }));
vi.mock('@/components/shared/ChangeHistoryPanel', () => ({ ChangeHistoryPanel: () => null }));

afterEach(cleanup);

describe('detalle de costo consolidado con subcategorías por producto', () => {
  it('muestra las tres clasificaciones y conserva el total único de la factura', () => {
    const cost = { id: 'cost-1', description: 'Implementos S.A.', date: '2026-10-17', amount: 223040,
      category_id: 'inventory', cost_categories: { name: 'Inventario' }, subcategory: null,
      supplier_invoice_id: 'invoice-1', supplier_id: 'supplier-1', cranes: null, operators: null, services: null } as unknown as Cost;
    render(<ConsolidatedCostDetails cost={cost} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Partes y Piezas · 1 línea(s)')).toBeInTheDocument();
    expect(screen.getByText('Consumibles · 1 línea(s)')).toBeInTheDocument();
    expect(screen.getByText('Herramientas · 1 línea(s)')).toBeInTheDocument();
    expect(screen.getByText('La factura mantiene un solo costo consolidado. El IVA se muestra en el total del documento.')).toBeInTheDocument();
    expect(screen.getAllByText(/223\.040/).length).toBeGreaterThan(0);
    const cells = within(screen.getByRole('row', { name: /SPYFRE0015/ })).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('Partes y Piezas');
    expect(cells[3]).toHaveTextContent('4');
    expect(screen.getByRole('cell', { name: 'Consumibles' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Herramientas' })).toBeInTheDocument();
  });
});
