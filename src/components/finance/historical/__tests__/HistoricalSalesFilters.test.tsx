import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoricalSalesFilters, FilterConfig } from '../HistoricalSalesFilters';
import { businessClock } from '@/utils/businessClock';

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
    searchTerm: '',
    clientName: '',
    folio: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
    source: 'all',
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

    expect(screen.getByPlaceholderText('Buscar por N° fiscal, cliente o folio...')).toBeInTheDocument();
    expect(screen.getByText('Filtros')).toBeInTheDocument();
  });

  it('calls onFilterChange when main search input changes', () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar por N° fiscal, cliente o folio...');
    fireEvent.change(searchInput, { target: { value: 'Test Client' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({
      searchTerm: 'Test Client'
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

    const filterButton = screen.getByText('Filtros');
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByText('Filtros Avanzados')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Mínimo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Máximo')).toBeInTheDocument();
    expect(screen.getByText('Desde')).toBeInTheDocument();
    expect(screen.getByText('Hasta')).toBeInTheDocument();
    expect(screen.getByText('Limpiar todo')).toBeInTheDocument();
  });

  it('calls onFilterChange when amount inputs change in popover', async () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    const filterButton = screen.getByText('Filtros');
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

  it('shows the origin (Origen) selector inside the advanced filters panel', async () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    fireEvent.click(screen.getByText('Filtros'));

    await waitFor(() => {
      expect(screen.getByText('Origen')).toBeInTheDocument();
    });
  });

  it('"Este Año" no incluye meses/días futuros (tope = hoy, no 31 de diciembre)', () => {
    render(
      <HistoricalSalesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    fireEvent.click(screen.getByText('Este Año'));

    const today = businessClock.todayDate();
    const lastCall = mockOnFilterChange.mock.calls.at(-1)?.[0];
    expect(lastCall.dateTo.getFullYear()).toBe(today.getFullYear());
    expect(lastCall.dateTo.getMonth()).toBe(today.getMonth());
    expect(lastCall.dateTo.getDate()).toBe(today.getDate());
  });

  it('ajusta automáticamente "Hasta" si "Desde" queda después (Desde <= Hasta)', async () => {
    const filtersWithRange: FilterConfig = {
      ...mockFilters,
      dateTo: new Date(2026, 0, 10), // 10 enero 2026
    };

    render(
      <HistoricalSalesFilters
        filters={filtersWithRange}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    fireEvent.click(screen.getByText('Filtros'));
    await waitFor(() => {
      expect(screen.getByText('Filtros Avanzados')).toBeInTheDocument();
    });

    // Abre el calendario de "Desde" (único trigger sin fecha seleccionada todavía)
    fireEvent.click(screen.getByText('Seleccionar'));
    await waitFor(() => {
      expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    });

    // Selecciona el día 20 (de un mes que por defecto cae después del 10 ya fijado en "Hasta")
    fireEvent.click(screen.getAllByText('20')[0]);

    const lastCall = mockOnFilterChange.mock.calls.at(-1)?.[0];
    expect(lastCall.dateFrom.getTime()).toBeLessThanOrEqual(lastCall.dateTo.getTime());
  });
});
