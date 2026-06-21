import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoricalPurchasesFilters, PurchaseFilterConfig } from '../HistoricalPurchasesFilters';
import { businessClock } from '@/utils/businessClock';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('HistoricalPurchasesFilters', () => {
  const mockFilters: PurchaseFilterConfig = {
    dateFrom: undefined,
    dateTo: undefined,
    searchTerm: '',
    supplierName: '',
    invoiceNumber: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
    productName: '',
    source: 'all',
  };

  const mockOnFilterChange = vi.fn();
  const mockOnClearFilters = vi.fn();

  it('renders main search input and filter button', () => {
    render(
      <HistoricalPurchasesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    expect(screen.getByPlaceholderText('Buscar por proveedor, N° factura o descripción...')).toBeInTheDocument();
    expect(screen.getByText('Filtros')).toBeInTheDocument();
  });

  it('shows the origin (Origen) selector inside the advanced filters panel', async () => {
    render(
      <HistoricalPurchasesFilters
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
      <HistoricalPurchasesFilters
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

  it('ajusta automáticamente "Desde" si "Hasta" queda antes (Desde <= Hasta)', async () => {
    const filtersWithRange: PurchaseFilterConfig = {
      ...mockFilters,
      dateFrom: new Date(2026, 0, 20), // 20 enero 2026
    };

    render(
      <HistoricalPurchasesFilters
        filters={filtersWithRange}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    fireEvent.click(screen.getByText('Filtros'));
    await waitFor(() => {
      expect(screen.getByText('Filtros Avanzados')).toBeInTheDocument();
    });

    // Abre el calendario de "Hasta" (único trigger sin fecha seleccionada todavía)
    fireEvent.click(screen.getByText('Seleccionar'));
    await waitFor(() => {
      expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    });

    // Selecciona el día 10 (anterior al 20 ya fijado en "Desde")
    fireEvent.click(screen.getAllByText('10')[0]);

    const lastCall = mockOnFilterChange.mock.calls.at(-1)?.[0];
    expect(lastCall.dateFrom.getTime()).toBeLessThanOrEqual(lastCall.dateTo.getTime());
  });

  it('calls onFilterChange when amount inputs change in popover', async () => {
    render(
      <HistoricalPurchasesFilters
        filters={mockFilters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
      />
    );

    fireEvent.click(screen.getByText('Filtros'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Mínimo')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Mínimo'), { target: { value: '1000' } });
    expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({ minAmount: '1000' }));
  });
});
