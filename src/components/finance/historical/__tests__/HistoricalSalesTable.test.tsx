import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoricalSalesTable, SortConfig } from '../HistoricalSalesTable';
import { Invoice } from '@/types';

// Mocking some dependencies if needed
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    ArrowUpDown: () => <span data-testid="sort-icon-default">SortDefault</span>,
    ArrowUp: () => <span data-testid="sort-icon-asc">SortAsc</span>,
    ArrowDown: () => <span data-testid="sort-icon-desc">SortDesc</span>,
    Edit: () => <span>Edit</span>,
  };
});

describe('HistoricalSalesTable', () => {
  const mockInvoices: Invoice[] = [
    {
      id: '1',
      folio: '1001',
      closureId: 'cl1',
      clientId: 'c1',
      issueDate: '2023-01-01',
      dueDate: '2023-01-15',
      subtotal: 1000,
      vat: 190,
      total: 1190,
      status: 'paid',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
      client: { id: 'c1', name: 'Client A', rut: '1-9' }
    },
    {
      id: '2',
      folio: '1002',
      closureId: 'cl2',
      clientId: 'c2',
      issueDate: '2023-01-02',
      dueDate: '2023-01-16',
      subtotal: 2000,
      vat: 380,
      total: 2380,
      status: 'sent',
      createdAt: '2023-01-02',
      updatedAt: '2023-01-02',
      client: { id: 'c2', name: 'Client B', rut: '2-7' }
    }
  ];

  const mockSortConfig: SortConfig = {
    key: 'issueDate',
    direction: 'desc'
  };

  const mockOnSort = vi.fn();
  const mockOnEdit = vi.fn();

  it('renders table headers and rows', () => {
    render(
      <HistoricalSalesTable
        invoices={mockInvoices}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText(/N°\s*Fiscal/i)).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Monto')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();

    expect(screen.getByText('1001')).toBeInTheDocument();
    expect(screen.getByText(/client a/i)).toBeInTheDocument();
    expect(screen.getByText('1002')).toBeInTheDocument();
    expect(screen.getByText(/client b/i)).toBeInTheDocument();
  });

  it('calls onSort when a header is clicked', () => {
    render(
      <HistoricalSalesTable
        invoices={mockInvoices}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    const clientHeader = screen.getByText('Cliente');
    fireEvent.click(clientHeader);

    expect(mockOnSort).toHaveBeenCalledWith('client');
  });

  it('calls onEdit when edit button is clicked', () => {
    render(
      <HistoricalSalesTable
        invoices={mockInvoices}
        sortConfig={mockSortConfig}
        onSort={mockOnSort}
        onEdit={mockOnEdit}
      />
    );

    const editIcon = screen.getAllByText('Edit')[0];
    fireEvent.click(editIcon);

    expect(mockOnEdit).toHaveBeenCalledWith(mockInvoices[0]);
  });
});
