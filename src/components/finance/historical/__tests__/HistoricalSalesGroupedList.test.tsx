import { render, screen, fireEvent } from '@testing-library/react';
import { HistoricalSalesGroupedList } from '../HistoricalSalesGroupedList';
import { Invoice } from '@/types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, ...props }: any) => <div data-testid="accordion" {...props}>{children}</div>,
  AccordionItem: ({ children, value, ...props }: any) => <div data-testid={`accordion-item-${value}`} {...props}>{children}</div>,
  AccordionTrigger: ({ children, ...props }: any) => <button data-testid="accordion-trigger" {...props}>{children}</button>,
  AccordionContent: ({ children, ...props }: any) => <div data-testid="accordion-content" {...props}>{children}</div>,
}));

vi.mock('../HistoricalSalesTable', () => ({
  HistoricalSalesTable: ({ invoices }: any) => (
    <div data-testid="historical-sales-table">
      {invoices.map((inv: Invoice) => (
        <div key={inv.id} data-testid="invoice-row">{inv.folio}</div>
      ))}
    </div>
  ),
}));

const mockInvoices: Invoice[] = [
  {
    id: '1',
    folio: 'INV-001',
    issueDate: new Date('2023-01-01'),
    total: 1000,
    status: 'paid',
    client: { id: 'c1', name: 'Client A' },
    items: [],
  } as unknown as Invoice,
  {
    id: '2',
    folio: 'INV-002',
    issueDate: new Date('2023-01-02'),
    total: 2000,
    status: 'pending',
    client: { id: 'c1', name: 'Client A' },
    items: [],
  } as unknown as Invoice,
  {
    id: '3',
    folio: 'INV-003',
    issueDate: new Date('2023-01-03'),
    total: 1500,
    status: 'paid',
    client: { id: 'c2', name: 'Client B' },
    items: [],
  } as unknown as Invoice,
];

describe('HistoricalSalesGroupedList', () => {
  const mockOnSort = vi.fn();
  const mockOnEdit = vi.fn();
  const mockSortConfig = { key: 'issueDate' as const, direction: 'desc' as const };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups invoices by client', () => {
    render(
      <HistoricalSalesGroupedList
        invoices={mockInvoices}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText(/client a/i)).toBeInTheDocument();
    expect(screen.getByText(/client b/i)).toBeInTheDocument();
    
    // Check counters
    expect(screen.getByText(/2\s+facturas\s+registradas/i)).toBeInTheDocument(); // Client A
    expect(screen.getByText(/1\s+facturas\s+registradas/i)).toBeInTheDocument(); // Client B
  });

  it('calculates totals correctly per group', () => {
    render(
      <HistoricalSalesGroupedList
        invoices={mockInvoices}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    // Client A total: 1000 + 2000 = 3000
    // Client B total: 1500
    // Note: formatCurrency usually adds symbol, checking parts
    expect(screen.getByText((content) => content.includes('3.000') || content.includes('3,000'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('1.500') || content.includes('1,500'))).toBeInTheDocument();
  });

  it('renders tables with correct invoices for each group', () => {
    render(
      <HistoricalSalesGroupedList
        invoices={mockInvoices}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    // Check if tables are rendered (mocked)
    const tables = screen.getAllByTestId('historical-sales-table');
    expect(tables).toHaveLength(2);
  });

  it('handles empty invoice list', () => {
    render(
      <HistoricalSalesGroupedList
        invoices={[]}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('No se encontraron resultados para agrupar.')).toBeInTheDocument();
  });
});
