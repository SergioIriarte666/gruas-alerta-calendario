import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManualCostPurchaseDialog } from '../ManualCostPurchaseDialog';

const mocks = vi.hoisted(() => ({ register: vi.fn(), extract: vi.fn(), prepare: vi.fn(), invalidate: vi.fn(), supplier: null as { id: string; name: string; rut: string } | null }));
vi.mock('@/services/manualCost', async importOriginal => ({ ...await importOriginal<typeof import('@/services/manualCost')>(), registerManualCost: mocks.register }));
vi.mock('@/services/manualPurchase', () => ({ extractPurchasePhoto: mocks.extract, preparePurchasePhoto: mocks.prepare }));
vi.mock('@/hooks/useCostCategories', () => ({ useCostCategories: () => ({ data: [{ id: 'inventory', name: 'Inventario' }], isPending: false }) }));
vi.mock('@/hooks/useCostCenters', () => ({ useCostCenters: () => ({ data: [], isPending: false }) }));
vi.mock('@/hooks/useCranes', () => ({ useCranes: () => ({ cranes: [{ id: 'crane', licensePlate: 'PXKZ-26' }] }) }));
vi.mock('@/hooks/useUniversalSync', () => ({ useUniversalSync: () => ({ invalidateAll: mocks.invalidate }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: { queryKey: string[] }) => ({ data: options.queryKey[0] === 'manual-cost-supplier-identity' ? mocks.supplier : [{ id: 'tools', name: 'Herramientas' }, { id: 'supplies', name: 'Consumibles' }], isFetching: false }) }));

const extraction = { vendorName: 'Dicar', vendorRut: '85.355.900-8', documentNumber: '54491', date: '2026-10-15', paymentMethod: 'contado', totals: { neto: 4000, iva: 760, total: 4760 }, items: [{ productCode: '00015-A', description: 'Herramienta', quantity: 4, unitPrice: 1000, unitPriceBasis: 'net', total: 4760 }] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.supplier = null;
  mocks.extract.mockResolvedValue(extraction);
  mocks.prepare.mockImplementation(async file => new File([file], 'foto.jpg', { type: 'image/jpeg' }));
  mocks.register.mockResolvedValue({ cost_id: 'cost' });
  URL.createObjectURL = vi.fn(() => 'blob:photo'); URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);
async function select(label: string, option: string) {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}
async function readPhoto() {
  fireEvent.change(screen.getByLabelText('Foto de la factura (opcional)'), { target: { files: [new File(['photo'], 'foto.HEIC', { type: 'image/heic' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Leer foto y precargar datos' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Leer foto y precargar datos' }));
  await waitFor(() => expect(screen.getByLabelText('Folio de factura *')).toHaveValue('54491'));
}
async function classify() {
  fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' }));
  await select('Categoría de costo *', 'Inventario');
}

describe('Foto/manual en Costos', () => {
  it('exige confirmar la razón social antes de corregir el maestro y vincular el costo', async () => {
    mocks.supplier = { id: 'supplier', name: 'Grúas 5 Norte SpA', rut: '85.355.900-8' };
    render(<ManualCostPurchaseDialog onClose={vi.fn()} />);
    await readPhoto();
    await classify();
    expect(screen.getByRole('button', { name: 'Revisar registro' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar nombre del comprobante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar registro' }));
    expect(screen.getByText(/Proveedor a vincular: Dicar · RUT emisor 85355900-8/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro en Costos' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    expect(mocks.register.mock.calls[0][1]).toMatchObject({ supplier_rut: '85355900-8', supplier_name: 'Dicar', confirm_supplier_name: true });
  });

  it('precarga códigos y precios netos, clasifica por producto y confirma solo al final', async () => {
    const onClose = vi.fn();
    render(<ManualCostPurchaseDialog onClose={onClose} />);
    expect(screen.getByText('Ingreso manual sin foto')).toBeInTheDocument();
    expect(screen.queryByText('Esperando XML')).not.toBeInTheDocument();
    await readPhoto();
    expect(screen.getByLabelText('Código')).toHaveValue('00015-A');
    expect(screen.getByLabelText('Precio unit. neto *')).toHaveValue(1000);
    expect(mocks.register).not.toHaveBeenCalled();
    await classify();
    expect(screen.getByRole('button', { name: /^Pendiente$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/Bodega de ingreso/)).not.toBeInTheDocument();
    await select('Subcategoría del producto 1', 'Herramientas');
    await select('Grúa de referencia (opcional)', 'PXKZ-26');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar registro' }));
    expect(screen.getByText('Herramientas')).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro en Costos' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const [request, payload, photo] = mocks.register.mock.calls[0];
    expect(request).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload).toMatchObject({ total_amount: 4760, category_id: 'inventory', crane_id: 'crane', is_paid: false, payment_date: null, lines: [expect.objectContaining({ product_code: '00015-A', unit_price: 1000, cost_subcategory_id: 'tools' })] });
    expect(photo.name).toBe('foto.jpg');
  });
  it('admite sin detalle, conserva el pago explícito y reintenta con el mismo identificador', async () => {
    mocks.register.mockRejectedValueOnce(new Error('Conexión interrumpida'));
    render(<ManualCostPurchaseDialog onClose={vi.fn()} />);
    await readPhoto();
    fireEvent.click(screen.getByRole('checkbox', { name: /Registrar solo los totales/ }));
    expect(screen.queryByLabelText('Producto 1 *')).not.toBeInTheDocument();
    await classify();
    await select('Subcategoría del gasto', 'Consumibles');
    fireEvent.click(screen.getByRole('button', { name: /^Pagada$/ }));
    expect(screen.getByLabelText('Fecha de pago *')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Referencia de pago'), { target: { value: 'OP-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar registro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro en Costos' }));
    await screen.findByText(/Conexión interrumpida/);
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar guardado' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(2));
    expect(mocks.register.mock.calls[0]).toEqual(mocks.register.mock.calls[1]);
    expect(mocks.register.mock.calls[0][1]).toMatchObject({ lines: [], header_subcategory_id: 'supplies', is_paid: true, payment_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), payment_reference: 'OP-123' });
  });
  it('permite escribir sin foto y bloquea totales incorrectos', async () => {
    render(<ManualCostPurchaseDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Registrar solo los totales/ }));
    for (const [label, value] of [['Proveedor *', 'Dicar'], ['RUT del proveedor *', '85355900-8'], ['Folio de factura *', '54504'], ['Neto del comprobante *', '1000'], ['IVA del comprobante *', '190'], ['Total del comprobante *', '1200']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByLabelText('Fecha de emisión *'));
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    fireEvent.keyDown(screen.getByRole('gridcell', { name: '15' }), { key: 'Escape' });
    expect(screen.getByText(/Total no cuadra/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Total del comprobante *'), { target: { value: '1190' } });
    await classify();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar registro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar registro en Costos' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    expect(mocks.register.mock.calls[0][2]).toBeNull();
    expect(mocks.extract).not.toHaveBeenCalled();
  });
});
