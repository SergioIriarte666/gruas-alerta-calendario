import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchEditHistoricalPurchasesModal } from '../BatchEditHistoricalPurchasesModal';

const updateInvoice = vi.fn();
const deleteInvoice = vi.fn();

vi.mock('@/hooks/usePurchaseInvoices', () => ({
  usePurchaseInvoices: () => ({ updateInvoice, deleteInvoice }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('BatchEditHistoricalPurchasesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateInvoice.mockResolvedValue({});
  });

  it('updates the glosa only for the selected purchase invoices', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <BatchEditHistoricalPurchasesModal
        selectedIds={['purchase-1', 'purchase-2']}
        open
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        initialAction="update_description"
        lockAction
      />,
    );

    expect(screen.getByText('Editar glosa')).toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: 'Guardar glosa' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Descripción de producto o servicio'), {
      target: { value: 'Compra de combustible para grúas' },
    });
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateInvoice).toHaveBeenCalledTimes(2));
    expect(updateInvoice).toHaveBeenNthCalledWith(1, {
      id: 'purchase-1',
      data: {
        product_service_description: 'Compra de combustible para grúas',
        description: 'Compra de combustible para grúas',
      },
    });
    expect(updateInvoice).toHaveBeenNthCalledWith(2, {
      id: 'purchase-2',
      data: {
        product_service_description: 'Compra de combustible para grúas',
        description: 'Compra de combustible para grúas',
      },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
