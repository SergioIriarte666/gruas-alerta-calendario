import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PurchaseReceiptMigrationDialog } from '../PurchaseReceiptMigrationDialog';

const migrate = vi.hoisted(() => vi.fn());
vi.mock('@/services/receiptPhotos', () => ({ migratePurchaseReceiptPhotos: migrate, checkPurchaseReceiptPhotos: async () => ({ success: true, bucket: 'g5n-comprobantes-compras' }) }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe('Traslado de respaldos anteriores a R2', () => {
  it('no migra al abrir y procesa los lotes sin modificar datos del comprobante', async () => {
    migrate.mockResolvedValueOnce({ results: [{ path: 'primero', migrated: true }], nextCursor: 'primero' });
    migrate.mockResolvedValueOnce({ results: [{ path: 'segundo', migrated: false, error: 'SHA-256 no coincide' }], nextCursor: null });
    render(<PurchaseReceiptMigrationDialog onClose={vi.fn()} />);
    expect(migrate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar respaldos anteriores a R2' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 respaldo(s) trasladado(s) y verificado(s) · 1 pendiente(s)'));
    expect(migrate.mock.calls).toEqual([[''], ['primero']]);
    expect(screen.getByText(/SHA-256 no coincide/)).toBeInTheDocument();
  });
  it('informa el fallo y permite volver a consultar pendientes sin afirmar éxito', async () => {
    migrate.mockRejectedValueOnce(new Error('No se pudo verificar R2'));
    render(<PurchaseReceiptMigrationDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar respaldos anteriores a R2' }));
    await waitFor(() => expect(screen.getByText('No se pudo verificar R2')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('0 respaldo(s) trasladado(s)');
    expect(screen.getByRole('button', { name: 'Revisar pendientes y reintentar' })).toBeEnabled();
  });
});
