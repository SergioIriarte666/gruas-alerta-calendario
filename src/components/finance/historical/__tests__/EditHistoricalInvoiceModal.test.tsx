import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditHistoricalInvoiceModal } from '../EditHistoricalInvoiceModal';
import { Invoice } from '@/types';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('EditHistoricalInvoiceModal', () => {
  const mockInvoice: Invoice = {
    id: '1',
    folio: '1001',
    closureId: 'cl1',
    clientId: 'c1',
    issueDate: '2023-01-01',
    dueDate: '2023-01-15',
    subtotal: 1000,
    vat: 190,
    total: 1190,
    status: 'sent',
    productServiceDescription: 'Descripción de prueba ventas 1',
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
    client: { id: 'c1', name: 'Client A', rut: '1-9' },
    notes: 'Initial notes',
  };

  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  it('renders modal with invoice details when open', () => {
    render(
      <EditHistoricalInvoiceModal
        invoice={mockInvoice}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Editar Factura Histórica 1001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Initial notes')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('calls onSave with updated data including metadata', async () => {
    render(
      <EditHistoricalInvoiceModal
        invoice={mockInvoice}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    // Update notes
    const notesInput = screen.getByDisplayValue('Initial notes');
    fireEvent.change(notesInput, { target: { value: 'Updated notes' } });

    // Update shipping info
    const shippingInput = screen.getByPlaceholderText('Ej: Chilexpress 123456');
    fireEvent.change(shippingInput, { target: { value: 'FedEx 123' } });

    // Click Save
    const saveButton = screen.getByText('Guardar Cambios');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });

    const calledArgs = mockOnSave.mock.calls[0];
    const invoiceId = calledArgs[0];
    const updates = calledArgs[1];

    expect(invoiceId).toBe('1');
    expect(updates.notes).toContain('Updated notes');
    expect(updates.notes).toContain('METADATA (SISTEMA)');
    expect(updates.notes).toContain('FedEx 123');
  });

  it('parses existing metadata correctly', () => {
    const metadata = {
      shippingInfo: 'Old Shipping',
      paymentMethod: 'Cash',
      auditLog: []
    };
    const notesWithMetadata = `User notes\n\n--- METADATA (SISTEMA) ---\n${JSON.stringify(metadata)}`;
    
    const invoiceWithMetadata = {
      ...mockInvoice,
      notes: notesWithMetadata
    };

    render(
      <EditHistoricalInvoiceModal
        invoice={invoiceWithMetadata}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByDisplayValue('User notes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Old Shipping')).toBeInTheDocument();
  });
});
