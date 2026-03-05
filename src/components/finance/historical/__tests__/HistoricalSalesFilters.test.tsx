import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoricalSalesFilters, FilterConfig } from '../HistoricalSalesFilters';

// Mock ResizeObserver which is used by some shadcn/radix components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('HistoricalSalesFilters', () => {
  const mockFilters: FilterConfig = {
    dateFrom: undefined,
    dateTo: undefined,
    clientName: '',
    folio: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
  };

  const mockOnFilterChange = vi.fn();
  const mockOnClearFilters = vi.fn();

  it('renders main search input and filter button', () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    expect(screen.getByPlaceholderText('Buscar por cliente o folio...')).toBeInTheDocument();
    expect(screen.getByText('Filtros Avanzados')).toBeInTheDocument();
  });

  it('calls onFilterChange when main search input changes', () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar por cliente o folio...');
    fireEvent.change(searchInput, { target: { value: 'Test Client' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      clientName: 'Test Client'
    }));
  });

  it('opens popover and shows advanced filters', async () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const filterButton = screen.getByText('Filtros Avanzados');
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByText('Filtros')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Mínimo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Máximo')).toBeInTheDocument();
    expect(screen.getByText('Desde')).toBeInTheDocument();
    expect(screen.getByText('Hasta')).toBeInTheDocument();
    expect(screen.getByText('Limpiar')).toBeInTheDocument();
  });

  it('calls onFilterChange when amount inputs change in popover', async () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const filterButton = screen.getByText('Filtros Avanzados');
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Mínimo')).toBeInTheDocument();
    });

    const minInput = screen.getByPlaceholderText('Mínimo');
    fireEvent.change(minInput, { target: { value: '1000' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      minAmount: '1000'
    }));

    const maxInput = screen.getByPlaceholderText('Máximo');
    fireEvent.change(maxInput, { target: { value: '5000' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      maxAmount: '5000'
    }));
  });
});
