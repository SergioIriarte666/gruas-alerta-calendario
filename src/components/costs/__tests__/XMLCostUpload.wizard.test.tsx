import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { XMLCostUpload } from '../XMLCostUpload';
import { classifySelectedCostItems } from '@/utils/xml/xmlCostWizard';
import { getDocumentStateKey } from '@/utils/xml/xmlGlosaHelpers';
import type { XMLDocumentData } from '@/types/suppliers';

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/hooks/xml/useXmlCostUpload', () => ({ useXmlCostUpload: () => useTestUpload() }));
vi.mock('@/components/common/XMLDropzoneArea', () => ({ XMLDropzoneArea: () => <p>7069653.xml</p> }));
vi.mock('@/components/ui/batch-progress-modal', () => ({ BatchProgressModal: () => null }));

const subcategories = ['Partes y Piezas', 'Consumibles', 'Herramientas'].map((name, index) => ({ id: `sub-${index}`, name, category_id: 'inventory' }));
const document = { folio: '7069653', supplier_rut: '78924030-2', total_amount: 223040, issue_date: '2026-10-17',
  items: ['Patín', 'Pilas', 'Probador'].map((description, index) => ({ description, quantity: index === 0 ? 4 : 1, unit_price: [43269, 1756, 12597][index], subtotal: [173076, 1756, 12597][index], total: [205960.44, 2089.64, 14990.43][index] })),
} as XMLDocumentData;
const documentKey = getDocumentStateKey(document);

function useTestUpload() {
  const noop = () => {};
  const [step, setStep] = useState(1);
  const [paidOverrides, setPaidOverrides] = useState<Record<string, boolean>>({});
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [lineSubcategories, setLineSubcategories] = useState<Record<string, string>>(Object.fromEntries(subcategories.map((option, index) => [`${documentKey}:${index}`, option.id])));
  const [selectedLines, setSelectedLines] = useState(new Set([0, 1, 2]));
  const [expandedDocumentDetails, setExpandedDocumentDetails] = useState<Record<string, boolean>>({});
  const [documentDescriptionOverrides, setDocumentDescriptionOverrides] = useState<Record<string, string>>({});
  const reviewError = paidOverrides[documentKey] && !paidDateOverrides[documentKey] ? 'Indica una fecha de pago válida para cada documento pagado.' : null;
  return {
    step, setStep, lineSubcategories, setLineSubcategories, costSubcategories: subcategories,
    selectedFile: { name: '7069653.xml' }, isAnalyzing: false, isUploading: false, uploadProgress: 0,
    parseResult: { documents: [document], suppliers: [{ name: 'Implementos S.A.', rut: document.supplier_rut }], totalDocuments: 1, validDocuments: 1, totalSuppliers: 1, validSuppliers: 1, errors: [], warnings: [] },
    getRootProps: noop, getInputProps: noop, isDragActive: false, triggerAnalyze: noop,
    isCheckingDuplicates: false, isSearchingMatches: false, showDuplicateWarning: false,
    setShowDuplicateWarning: noop, duplicateResults: [], matchedCosts: {}, linkDecisions: {}, handleLinkDecisionChange: noop,
    selectedSuppliers: new Set([document.supplier_rut]), selectedDocuments: new Set([documentKey]),
    selectedTotal: 223040, uploadableCount: 1, uploadableDocuments: [document],
    getSelectedLineSet: () => selectedLines, getSelectedLineCount: () => selectedLines.size, hasSelectedLines: () => !!selectedLines.size,
    getDocumentAmount: () => 223040, toggleLineSelection: (_document: XMLDocumentData, index: number) => setSelectedLines(previous => {
      const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next;
    }), toggleAllLines: noop,
    supplierCategoryMapping: { [document.supplier_rut]: 'inventory' }, setSupplierPaymentCondition: noop,
    supplierCreditDate: {}, setSupplierCreditDate: noop, setDueDateOverrides: noop,
    paidOverrides, setPaidOverrides, paidDateOverrides, setPaidDateOverrides,
    documentDescriptionOverrides, setDocumentDescriptionOverrides, expandedDocumentDetails, setExpandedDocumentDetails,
    historicalGlosaSuggestions: {}, syncToInventory: false, setSyncToInventory: noop,
    activeCategories: [{ id: 'inventory', name: 'Inventario', label: 'Inventario' }], paymentTerms: [], loadingTerms: false,
    batchProgress: { state: {}, close: noop }, getSupplierCondition: () => 'none', getDuplicateInfoForDocument: noop,
    buildSuggestedGlosa: () => 'Compra de productos', getEffectiveGlosa: () => 'Compra de productos', applyConditionToSupplierDocuments: noop,
    resolveCategoryId: (value: string) => value, handleUploadCosts: mocks.upload, reset: noop, handleCategoryChange: noop,
    toggleSupplierSelection: noop, toggleDocumentSelection: noop, selectAllDocuments: noop, clearSelectedDocuments: noop,
    getDocumentEntity: () => 'gruas_5_norte', lowboyCraneOptions: [], craneIdByDocument: {}, setCraneIdByDocument: noop,
    paidByDocument: {}, setPaidByDocument: noop, hasLowboyDocuments: false, configurationError: null, reviewError,
    getDocumentDueDate: () => '2026-10-31', getClassifiedItems: () => classifySelectedCostItems(document, selectedLines, lineSubcategories, subcategories, 'inventory'),
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Importación XML de Costos por etapas', () => {
  it('no ofrece una subcategoría global, revisa tres clasificaciones y guarda solo al confirmar', () => {
    render(<XMLCostUpload isOpen onClose={vi.fn()} />);
    expect(screen.queryByRole('combobox', { name: /Subcategoría/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar carga/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getAllByRole('combobox', { name: /Subcategoría del producto/ })).toHaveLength(6);
    expect(screen.getByRole('switch', { name: 'Marcar como pagado' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar carga' }));
    expect(screen.getByText('Partes y Piezas · 1 producto(s)')).toBeInTheDocument();
    expect(screen.getByText('Consumibles · 1 producto(s)')).toBeInTheDocument();
    expect(screen.getByText('Herramientas · 1 producto(s)')).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar carga (1)' }));
    expect(mocks.upload).toHaveBeenCalledOnce();
  });
  it('mantiene el pago al retroceder y permite volver a pendiente', () => {
    render(<XMLCostUpload isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Marcar como pagado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar carga' }));
    expect(screen.getByText(/Pagado ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByRole('switch', { name: 'Marcar como pagado' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('switch', { name: 'Marcar como pagado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar carga' }));
    expect(screen.getByText('Pendiente de pago')).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
