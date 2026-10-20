import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { XMLInventoryUpload } from '../XMLInventoryUpload';
import { useXmlInventoryUpload, type PendingProductSuggestion } from '@/hooks/xml/useXmlInventoryUpload';

const mocks = vi.hoisted(() => ({ register: vi.fn(), extract: vi.fn(), preparePhoto: vi.fn(), updateSupplier: vi.fn(), createSupplier: vi.fn(), createItem: vi.fn(), refetchItems: vi.fn(), catalog: null as { id: string; name: string; sku: string }[] | null, suppliers: [] as { id: string; name: string; rut: string }[] }));
vi.mock('@/services/manualPurchase', () => ({ registerManualPurchase: mocks.register, extractPurchasePhoto: mocks.extract, preparePurchasePhoto: mocks.preparePhoto }));
vi.mock('@/hooks/useXMLParsing', () => ({ useXMLParsing: () => ({ selectedFile: null, parseResult: null, isAnalyzing: false, getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false, reset: vi.fn() }) }));
vi.mock('@/hooks/useInventory', () => ({
  useInventoryItems: () => ({ data: mocks.catalog || tools.map((name, index) => ({ id: `item-${index}`, name })), refetch: mocks.refetchItems }),
  useInventoryCategories: () => ({ data: [] }), useInventoryLocations: () => ({ data: [{ id: 'warehouse', code: 'MAIN', name: 'Bodega principal' }] }), useCreateInventoryItem: () => ({ mutateAsync: mocks.createItem }),
}));
vi.mock('@/hooks/useSuppliers', () => ({ useSuppliers: () => ({ suppliers: mocks.suppliers, createSupplierAsync: mocks.createSupplier, updateSupplierAsync: mocks.updateSupplier }) }));
vi.mock('@/hooks/useUniversalSync', () => ({ useUniversalSync: () => ({ invalidateAll: vi.fn(), refetchCritical: vi.fn() }) }));
vi.mock('@/hooks/useCostCategories', () => ({ useCostCategories: () => ({ data: [{ id: 'inventory', name: 'Inventario' }] }) }));
vi.mock('@/hooks/useCostSubcategories', () => ({ useCostSubcategories: () => ({ subcategories: [{ id: 'tools', name: 'Herramientas' }] }) }));
vi.mock('@/hooks/useCostCenters', () => ({ useCostCenters: () => ({ data: [] }) }));
vi.mock('@/hooks/useCranes', () => ({ useCranes: () => ({ operationalCranes: [{ id: 'crane-1', licensePlate: 'PXKZ-26' }, { id: 'crane-2', licensePlate: 'DSBZ-85' }] }) }));
vi.mock('@/hooks/useOperators', () => ({ useOperators: () => ({ operators: [] }) }));
vi.mock('@/hooks/useServices', () => ({ useServices: () => ({ getServicesForCosts: () => [] }) }));
vi.mock('@/components/cranes/forms/SimilarProductAlert', () => ({ SimilarProductAlert: () => null }));
vi.mock('@/components/inventory/ProductDetailsModal', () => ({ ProductDetailsModal: () => null }));

const tools = ['Dado Torx', 'Dado impacto Torx', 'Dado largo', 'Llave rueda'];
const extraction = { vendorName: 'Ferretería y Repuestos Dicar Ltda.', vendorRut: '85.355.900-8', documentNumber: '54491', date: '2026-10-15', paymentMethod: 'débito',
  totals: { neto: 127606, iva: 24245, total: 151851 }, items: tools.map((description, index) => ({ productCode: ['DAT89040-1', 'DAT89040-2', 'DIL89938', 'LLR90030'][index], description, quantity: 1, unitPrice: [6723, 7983, 31900, 81000][index], unitPriceBasis: 'net', total: [6723, 7983, 31900, 81000][index] })),
};

beforeEach(() => {
  mocks.catalog = null;
  mocks.refetchItems.mockResolvedValue({ data: [], error: null });
  mocks.suppliers = [{ id: 'supplier', name: 'Ferretería y Repuestos Dicar Ltda.', rut: '85.355.900-8' }];
  mocks.updateSupplier.mockResolvedValue({ id: 'supplier' });
  mocks.register.mockResolvedValue({ cost_id: 'cost' });
  mocks.extract.mockResolvedValue(extraction);
  mocks.preparePhoto.mockImplementation(async file => new File([file], 'IMG_5940.jpg', { type: 'image/jpeg' }));
  URL.createObjectURL = vi.fn(() => 'blob:purchase-photo');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function readPhoto() {
  fireEvent.click(screen.getByRole('button', { name: 'Desde foto / manual' }));
  fireEvent.change(screen.getByLabelText('Foto de la factura (opcional)'), { target: { files: [new File(['photo'], 'IMG_5940.HEIC', { type: 'image/heic' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Leer foto y precargar datos' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Leer foto y precargar datos' }));
  await waitFor(() => expect(screen.getByLabelText('Folio de factura *')).toHaveValue('54491'));
}

describe('Compra desde foto y registro manual', () => {
  const pendingCreation = (): PendingProductSuggestion => ({
    doc: { folio: '54504', document_type: 'factura', issue_date: '2026-10-16', net_amount: 29412, vat_amount: 5588, total_amount: 35000, currency: 'CLP', description: 'Dicar', supplier_rut: '85355900-8' },
    line: { key: '54504-2', lineNumber: 2, item: { product_code: 'DAT89040-2', description: 'DADO IMPACTO TORX T-40 FORCE', quantity: 2, unit_price: 7983, total: 19000 }, matchedItem: null, candidates: [], error: null, warning: null },
    similarityResult: { shouldAlert: true, similarItems: [], alertMessage: '' },
  });
  it('reconsulta el catálogo y reutiliza un SKU existente incluso al confirmar crear nuevo', async () => {
    const existing = { id: 'existing-impacto', name: 'Dado Impacto Torx 1/2" X 38Mm Ferton', sku: 'DAT89040-2' };
    mocks.refetchItems.mockResolvedValue({ data: [existing], error: null });
    const { result } = renderHook(() => useXmlInventoryUpload({ onClose: vi.fn(), onSuccess: vi.fn() }));
    act(() => result.current.setPendingProductSuggestion(pendingCreation()));
    await act(async () => result.current.handleCreateSuggestedNew());
    expect(result.current.manualMatchedItems['54504-2']?.id).toBe('existing-impacto');
    expect(mocks.createItem).not.toHaveBeenCalled();
  });
  it('no crea productos si falla la comprobación final de duplicados', async () => {
    mocks.refetchItems.mockResolvedValue({ data: undefined, error: new Error('Sin conexión') });
    const { result } = renderHook(() => useXmlInventoryUpload({ onClose: vi.fn(), onSuccess: vi.fn() }));
    act(() => result.current.setPendingProductSuggestion(pendingCreation()));
    await act(async () => result.current.handleCreateSuggestedNew());
    expect(mocks.createItem).not.toHaveBeenCalled();
  });
  it('reconoce Dicar por RUT y sugiere el SKU con un cero faltante sin crear ni vincular a ciegas', async () => {
    mocks.suppliers = [{ id: 'dicar', name: 'Ferreteria y Repuestos Dicar Limitada', rut: '853559008' }];
    mocks.catalog = [
      { id: 'torx', name: 'Dado Torx T-40 Largo Force', sku: 'DAT89040-1' },
      { id: 'impacto', name: 'Dado Impacto Torx 1/2" X 38Mm Ferton', sku: 'DAT89040-2' },
    ];
    mocks.extract.mockResolvedValueOnce({ ...extraction, items: [
      { productCode: 'DAT8940-1', description: 'DADO TORX T-40 LARGO FORCE', quantity: 2, unitPrice: 6723, unitPriceBasis: 'net' },
      { productCode: 'DAT8940-2', description: 'DADO IMPACTO TORX T-40 FORCE', quantity: 2, unitPrice: 7983, unitPriceBasis: 'net' },
    ], totals: { neto: 29412, iva: 5588, total: 35000 } });
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await readPhoto();
    expect(screen.getByText(/Proveedor existente por RUT:/)).toHaveTextContent('Ferreteria y Repuestos Dicar Limitada');
    fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    expect(screen.getAllByText(/Código del comprobante: DAT8940-1/)[0]).toHaveTextContent('DAT89040-1');
    expect(screen.getByText(/Código leído: DAT8940-2/)).toBeInTheDocument();
    expect(screen.getByText('DAT89040-2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar importación/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Conservar nombre registrado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    expect(screen.getByRole('button', { name: /Revisar importación/ })).toBeEnabled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.createSupplier).not.toHaveBeenCalled();
    expect(mocks.updateSupplier).not.toHaveBeenCalled();
  });
  it('exige resolver un nombre incorrecto del maestro y guarda Río Copiapó sin cambiar su RUT', async () => {
    mocks.suppliers = [{ id: 'rio', name: 'Grúas 5 Norte SpA', rut: '77.084.699-4' }, { id: 'own-company', name: 'Grúas 5 Norte SpA', rut: '76.769.841-0' }];
    mocks.extract.mockResolvedValueOnce({ ...extraction, vendorName: 'Comercializadora Rio Copiapo Spa', vendorRut: '77.084.699-4' });
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await readPhoto();
    fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    expect(screen.getByText(/Proveedor registrado: Grúas 5 Norte SpA/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar importación/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar nombre del comprobante' }));
    fireEvent.click(screen.getByRole('button', { name: /Revisar importación/ }));
    expect(screen.getByText(/Factura 54491 · Comercializadora Rio Copiapo Spa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Importar compra/ }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    expect(mocks.updateSupplier).toHaveBeenCalledWith({ id: 'rio', data: { name: 'Comercializadora Rio Copiapo Spa' } });
    expect(mocks.register.mock.calls[0][1]).toMatchObject({ p_supplier_id: 'rio', p_notes: expect.stringContaining('Proveedor: Comercializadora Rio Copiapo Spa') });
    expect(mocks.createSupplier).not.toHaveBeenCalled();
  });

  it('registra una compra escrita manualmente sin foto y permite indicar que está pagada', async () => {
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desde foto / manual' }));
    for (const [label, value] of [['Proveedor *', 'Ferretería y Repuestos Dicar Ltda.'], ['RUT del proveedor *', '85355900-8'], ['Folio de factura *', '54504'], ['Producto 1 *', tools[0]], ['Precio unit. neto *', '1000'], ['Neto del comprobante *', '1000'], ['IVA del comprobante *', '190'], ['Total del comprobante *', '1190']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByLabelText('Fecha de emisión *'));
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    fireEvent.keyDown(screen.getByRole('gridcell', { name: '15' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pagada' }));
    expect(screen.getByLabelText('Fecha de pago *')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Revisar importación/ }));
    expect(screen.getByText(/ingreso manual sin foto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Importar compra/ }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    expect(mocks.register.mock.calls[0][1]).toMatchObject({ p_folio: '54504', p_total_amount: 1190, p_is_paid: true, p_entity: 'gruas_5_norte', p_paid_by: 'gruas_5_norte', p_cost_subcategory: null, p_cost_subcategory_id: null, p_payment_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(mocks.register.mock.calls[0][2]).toBeNull();
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it('permite elegir quién financia la compra y una subcategoría por defecto para todos los productos', async () => {
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desde foto / manual' }));
    for (const [label, value] of [['Proveedor *', 'Ferretería y Repuestos Dicar Ltda.'], ['RUT del proveedor *', '85355900-8'], ['Folio de factura *', '54505'], ['Producto 1 *', tools[0]], ['Precio unit. neto *', '1000'], ['Neto del comprobante *', '1000'], ['IVA del comprobante *', '190'], ['Total del comprobante *', '1190']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByLabelText('Fecha de emisión *'));
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    fireEvent.keyDown(screen.getByRole('gridcell', { name: '15' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' }));
    expect(screen.getByLabelText('Empresa')).toHaveTextContent('Grúas 5 Norte SpA');
    fireEvent.keyDown(screen.getByLabelText('Financiado por'), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'LowBoy Chile SpA' }));
    fireEvent.keyDown(screen.getByLabelText('Subcategoría'), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Herramientas' }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    expect(screen.getByLabelText('Subcategoría del producto', { selector: '#subcategory-54505-1' })).toHaveTextContent('Herramientas');
    fireEvent.click(screen.getByRole('button', { name: /Revisar importación/ }));
    expect(screen.getByText('Empresa: Grúas 5 Norte SpA · Financiado por LowBoy Chile SpA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Importar compra/ }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    const args = mocks.register.mock.calls[0][1];
    expect(args).toMatchObject({ p_folio: '54505', p_entity: 'gruas_5_norte', p_paid_by: 'lowboy', p_cost_subcategory: 'Herramientas', p_cost_subcategory_id: 'tools' });
    expect(args.p_lines[0].cost_subcategory_id).toBe('tools');
  });

  it('precarga el comprobante, exige revisión y registra una sola compra con foto al confirmar', async () => {
    const onSuccess = vi.fn();
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    await readPhoto();
    expect(screen.getByLabelText('Proveedor *')).toHaveValue('Ferretería y Repuestos Dicar Ltda.');
    expect(screen.getByLabelText('Total del comprobante *')).toHaveValue(151851);
    expect(screen.getAllByLabelText('Código').map(input => (input as HTMLInputElement).value)).toEqual(['DAT89040-1', 'DAT89040-2', 'DIL89938', 'LLR90030']);
    expect(mocks.register).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' }));
    expect(screen.getByRole('button', { name: 'Pagada' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    expect(screen.getAllByLabelText('Destino del producto')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Descartar línea 1' })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('Subcategoría del producto', { selector: '#subcategory-54491-1' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Herramientas' }));
    fireEvent.click(screen.getByRole('button', { name: /Revisar importación/ }));
    expect(screen.getByText(/foto revisada; se guardará como respaldo/)).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Importar compra/ }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    const [request, args, photo] = mocks.register.mock.calls[0];
    expect(request).toMatch(/^[0-9a-f-]{36}$/);
    expect(args).toMatchObject({ p_folio: '54491', p_supplier_id: 'supplier', p_total_amount: 151851, p_net_amount: 127606, p_vat_amount: 24245, p_is_paid: false, p_xml_file_name: null });
    expect(args.p_lines).toHaveLength(4);
    expect(args.p_lines[0].cost_subcategory_id).toBe('tools');
    expect(args.p_lines[0].product_code).toBe('DAT89040-1');
    expect(photo).toBeInstanceOf(File);
    expect(photo.name).toBe('IMG_5940.jpg');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(1));
  });
  it('bloquea importes que no cuadran y permite corregirlos sin guardar', async () => {
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await readPhoto();
    fireEvent.change(screen.getByLabelText('Total del comprobante *'), { target: { value: '150000' } });
    expect(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' })).toBeDisabled();
    expect(screen.getByText(/Total no cuadra:/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Total del comprobante *'), { target: { value: '151851' } });
    expect(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' })).toBeEnabled();
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('señala el IVA exacto que no cuadra en lugar de culpar a todas las líneas', async () => {
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await readPhoto();
    fireEvent.change(screen.getByLabelText('IVA del comprobante *'), { target: { value: '24345' } });
    expect(screen.getByText(/IVA no cuadra: comprobante \$24.345; calculado \$24.245 \(diferencia \$100\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('IVA del comprobante *'), { target: { value: '24245' } });
    expect(screen.getByRole('button', { name: 'Usar estos datos y clasificar compra' })).toBeEnabled();
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('permite completar manualmente cuando falla la lectura de la foto', async () => {
    mocks.extract.mockRejectedValueOnce(new Error('Servicio de lectura no disponible. Completa los datos manualmente.'));
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desde foto / manual' }));
    fireEvent.change(screen.getByLabelText('Foto de la factura (opcional)'), { target: { files: [new File(['photo'], 'foto.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leer foto y precargar datos' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Leer foto y precargar datos' }));
    expect(await screen.findByText('Servicio de lectura no disponible. Completa los datos manualmente.')).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText('Proveedor *')).toBeEnabled();
    expect(screen.getByLabelText('Producto 1 *')).toBeEnabled();
    expect(screen.getByAltText('Foto de respaldo de la compra')).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
