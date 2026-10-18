import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { XMLInventoryUpload } from '../XMLInventoryUpload';
import { applyCraneToSelectedLines } from '@/utils/xml/xmlInventoryWizard';
import { summarizeInvoiceClassifications } from '@/utils/xml/xmlInventoryClassification';
import type { LineConsumption } from '@/utils/xml/xmlInventoryConsumption';

const mocks = vi.hoisted(() => ({ importPurchase: vi.fn() }));
vi.mock('@/hooks/xml/useXmlInventoryUpload', () => ({ useXmlInventoryUpload: () => useTestUpload() }));
vi.mock('@/components/common/XMLDropzoneArea', () => ({ XMLDropzoneArea: () => <p>XML cargado: 7069653.xml</p> }));
vi.mock('@/components/cranes/forms/SimilarProductAlert', () => ({ SimilarProductAlert: () => null }));
vi.mock('@/components/inventory/ProductDetailsModal', () => ({ ProductDetailsModal: () => null }));

const subcategories = [{ id: 'parts', name: 'Partes y Piezas' }, { id: 'supplies', name: 'Consumibles' }, { id: 'tools', name: 'Herramientas' }];
const lines = ['Patín', 'Pilas', 'Probador'].map((name, index) => ({
  key: `7069653-${index + 1}`, lineNumber: index + 1,
  item: { description: name, quantity: index === 0 ? 4 : 1, unit_price: [43269, 1756, 12597][index], subtotal: [173076, 1756, 12597][index], total: [205960.44, 2089.64, 14990.43][index] },
  matchedItem: { id: `item-${index}`, name }, candidates: [], error: null, warning: null,
}));
const document = { doc: { folio: '7069653', total_amount: 223040, net_amount: 187429, vat_amount: 35611, issue_date: '2026-10-17', due_date: '2026-10-31', items: lines.map(line => line.item) },
  supplier: { name: 'Implementos S.A.' }, lines, isValid: true, errors: [], warnings: [] };

function useTestUpload() {
  const [step, setStep] = useState(1);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentDate, setPaymentDate] = useState('2026-10-18');
  const [paymentReference, setPaymentReference] = useState('');
  const [dueDateOverride, setDueDateOverride] = useState('');
  const [importNotes, setImportNotes] = useState('');
  const [selectedLineKeys, setSelectedLineKeys] = useState<Set<string>>(new Set());
  const [bulkCraneId, setBulkCraneId] = useState('');
  const [lineConsumptions, setLineConsumptions] = useState<Record<string, LineConsumption>>({
    '7069653-1': { immediate: true, quantity: 4, craneId: 'crane-1' },
    '7069653-2': { immediate: true, quantity: 1, craneId: 'crane-2' },
  });
  const [lineCostSubcategories, setLineCostSubcategories] = useState<Record<string, string>>({ '7069653-1': 'parts', '7069653-2': 'supplies', '7069653-3': 'tools' });
  const [showAdvancedAssociations, setShowAdvancedAssociations] = useState(false);
  const configurationError = isPaid && !paymentDate ? 'Indica una fecha de pago válida' : null;
  const noop = () => {};
  return {
    step, setStep, isPaid, setIsPaid, paymentDate, setPaymentDate, paymentReference, setPaymentReference,
    dueDateOverride, setDueDateOverride, importNotes, setImportNotes, selectedLineKeys, setSelectedLineKeys,
    bulkCraneId, setBulkCraneId, lineConsumptions, setLineConsumptions, lineCostSubcategories, setLineCostSubcategories,
    showAdvancedAssociations, setShowAdvancedAssociations, configurationError, reviewError: configurationError,
    applyBulkCrane: () => setLineConsumptions(previous => applyCraneToSelectedLines(lines.map(line => ({ key: line.key, quantity: line.item.quantity })), selectedLineKeys, previous, bulkCraneId)),
    activeSelectedLines: lines, selectedBulkLineCount: selectedLineKeys.size,
    selectedFile: { name: '7069653.xml' }, parseResult: { documents: [document.doc], suppliers: [] },
    isAnalyzing: false, isImporting: false, progress: 0, getRootProps: noop, getInputProps: noop, isDragActive: false,
    validatedDocuments: [document], selectedValidatedDocuments: [document], selectedDocuments: new Set(['7069653']),
    summary: { totalDocs: 1, validDocs: 1, totalLines: 3, invalidLines: 0 }, inventoryCatalog: [],
    toggleSelectedDocument: noop, selectAllDocuments: noop, clearSelectedDocuments: noop,
    manualMatchedItems: {}, setManualMatchedItems: noop, editedDescriptions: new Map(), setEditedDescriptions: noop,
    discardedLines: new Set(), setDiscardedLines: noop, catalogSearchOpen: {}, setCatalogSearchOpen: noop, creatingProductKeys: new Set(),
    selectedCostCategoryId: 'inventory', selectedCostCategory: { id: 'inventory', name: 'Inventario' }, setSelectedCostCategoryId: noop,
    selectedLocationId: 'warehouse', selectedLocation: { id: 'warehouse', name: 'Bodega LowBoy', code: 'LB001' }, setSelectedLocationId: noop,
    selectedCostCenterId: 'center', selectedCostCenter: { id: 'center', code: 'OPER', name: 'Operacionales' }, setSelectedCostCenterId: noop,
    selectedOperatorId: '', setSelectedOperatorId: noop, selectedServiceId: '', setSelectedServiceId: noop,
    selectedServiceFolio: '', setSelectedServiceFolio: noop, serviceSearchOpen: false, setServiceSearchOpen: noop,
    serviceSearchQuery: '', setServiceSearchQuery: noop, serviceSearchResults: [],
    costCategories: [{ id: 'inventory', name: 'Inventario' }], costSubcategories: subcategories,
    costCenters: [{ id: 'center', code: 'OPER', name: 'Operacionales', is_active: true }],
    locations: [{ id: 'warehouse', name: 'Bodega LowBoy', code: 'LB001' }],
    cranes: [{ id: 'crane-1', licensePlate: 'PXKZ-26' }, { id: 'crane-2', licensePlate: 'DSBZ-85' }], operators: [],
    classificationSummary: summarizeInvoiceClassifications(lines.map((line, index) => ({ cost_subcategory: subcategories[index].name, subtotal: line.item.subtotal }))),
    handleImport: mocks.importPurchase, handleClose: noop, resetState: noop, updateLineDescription: noop,
    handleCreateMissingProduct: noop, handleUseSuggestedProduct: noop, handleCreateSuggestedNew: noop,
    pendingProductSuggestion: null, setPendingProductSuggestion: noop, suggestedProductDetails: null, setSuggestedProductDetails: noop,
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('asistente XML con costo, pago, productos y revisión', () => {
  it('valida el pago, conserva los destinos y solo importa desde la revisión', async () => {
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByText('Grúa sugerida para consumo')).not.toBeInTheDocument();
    expect(screen.queryByText('Subcategoría predeterminada')).not.toBeInTheDocument();
    expect(screen.getByText('Subcategorías por producto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pagada' }));
    fireEvent.change(screen.getByLabelText('Fecha de pago *'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Continuar a productos/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Fecha de pago *'), { target: { value: '2026-10-18' } });
    fireEvent.change(screen.getByLabelText('Referencia de pago'), { target: { value: 'OP-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    expect(screen.getAllByLabelText('Grúa de destino')).toHaveLength(2);
    expect(screen.getAllByLabelText('Subcategoría del producto')).toHaveLength(3);
    expect(screen.queryByText(/Usar general:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Destino del producto', { selector: '#destination-7069653-3' })).toHaveTextContent('Mantener en bodega');
    fireEvent.click(screen.getByRole('button', { name: /Revisar importación/ }));
    expect(screen.getByRole('heading', { name: 'Revisión de la compra' })).toBeInTheDocument();
    expect(screen.getByText('Referencia: OP-123')).toBeInTheDocument();
    expect(screen.getByText('4 un. → PXKZ-26')).toBeInTheDocument();
    expect(screen.getByText('1 un. → DSBZ-85')).toBeInTheDocument();
    expect(screen.getByText('1 un. → Bodega LowBoy')).toBeInTheDocument();
    expect(mocks.importPurchase).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Importar compra/ }));
    expect(mocks.importPurchase).toHaveBeenCalledOnce();
  });

  it('aplica una grúa solo a los productos seleccionados y mantiene el pago al retroceder', async () => {
    render(<XMLInventoryUpload isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Continuar a productos/ }));
    fireEvent.click(screen.getByLabelText('Seleccionar producto 1 de factura 7069653'));
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Grúa para selección' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'DSBZ-85' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar a seleccionados' }));
    const destination = screen.getByLabelText('Grúa de destino', { selector: '#crane-7069653-1' });
    await waitFor(() => expect(destination).toHaveTextContent('DSBZ-85'));
    expect(screen.getByLabelText('Destino del producto', { selector: '#destination-7069653-3' })).toHaveTextContent('Mantener en bodega');
    fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));
    const paymentGroup = screen.getByRole('group', { name: 'Estado de pago' });
    expect(within(paymentGroup).getByRole('button', { name: 'Pendiente' })).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.importPurchase).not.toHaveBeenCalled();
  });
});
