import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HistoricalSalesTable } from '../HistoricalSalesTable';
import { HistoricalPurchasesTable } from '../HistoricalPurchasesTable';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ArrowUpDown: () => <span />,
    ArrowUp: () => <span />,
    ArrowDown: () => <span />,
    Edit: () => <span />,
    Trash2: () => <span />,
    Lock: () => <span />,
    Package: () => <span />,
  };
});

describe('Product/Service description column', () => {
  it('renders header in historical sales and purchases tables', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <HistoricalSalesTable
          invoices={[
            {
              id: '1',
              folio: 'HIST-F-1',
              closureId: 'c1',
              clientId: 'cl1',
              issueDate: '2025-01-01',
              dueDate: '2025-01-15',
              subtotal: 100,
              vat: 19,
              total: 119,
              status: 'paid',
              productServiceDescription: 'Descripción válida ventas',
              createdAt: '2025-01-01',
              updatedAt: '2025-01-01',
              client: { id: 'cl1', name: 'Cliente', rut: '1-9' },
            },
          ]}
          sortConfig={{ key: 'issueDate', direction: 'desc' }}
          onSort={() => {}}
          onEdit={() => {}}
          onSelectAll={() => {}}
          selectedIds={[]}
        />

        <HistoricalPurchasesTable
          invoices={[
            {
              id: 'p1',
              supplier_id: 's1',
              invoice_number: '123',
              issue_date: '2025-01-01',
              due_date: '2025-01-15',
              amount: 1000,
              currency: 'CLP',
              status: 'pending',
              description: null,
              product_service_description: 'Descripción válida compras',
              tax_amount: 190,
              net_amount: 810,
              payment_terms: null,
              paid_amount: null,
              balance: null,
              created_at: '2025-01-01',
              updated_at: '2025-01-01',
              supplier: { id: 's1', name: 'Proveedor', rut: '1-9' } as any,
            },
          ]}
          sortConfig={{ key: 'issue_date', direction: 'desc' }}
          onSort={() => {}}
          onEdit={() => {}}
          onSelectAll={(_ids, _checked) => {}}
          selectedIds={[]}
        />
      </QueryClientProvider>
    );

    const headers = screen.getAllByText('Descripción de Producto o Servicio');
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });
});
