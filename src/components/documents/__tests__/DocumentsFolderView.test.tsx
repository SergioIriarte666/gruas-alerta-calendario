import { describe, it, expect, vi } from 'vitest';
import { getDefaultNormalizer, render, screen, within } from '@testing-library/react';
import { DocumentsFolderView } from '../DocumentsFolderView';
import type { BusinessDocument } from '@/hooks/useBusinessDocuments';
import { getDocumentExpiryState } from '@/utils/businessDocuments';

// Los 15 documentos reales de business_documents al 2026-10-11 (sin archivos).
const REAL_DOCS: Array<Pick<BusinessDocument, 'title' | 'category' | 'tags' | 'related_entity_type' | 'related_entity_id' | 'expires_at'>> = [
  { title: 'Multas_DSBZ85', category: 'documentos_vehiculos', tags: ['multas mack'], related_entity_type: 'cost', related_entity_id: '6018b9bc-5968-473e-b84e-2db435f6bfe8', expires_at: null },
  { title: 'Anexo Exención de Responsabilidad Transporte', category: 'contratos', tags: [], related_entity_type: null, related_entity_id: null, expires_at: null },
  { title: 'Propiedad G5N', category: 'contratos', tags: ['escrituras'], related_entity_type: 'other', related_entity_id: null, expires_at: null },
  { title: 'Transferencia Pie Rampla Rendon', category: 'proveedores', tags: ['comprobante transferencia'], related_entity_type: 'supplier', related_entity_id: null, expires_at: null },
  { title: 'Chequeo Fatiga y Somnolencia', category: 'otros', tags: ['prevención riesgos'], related_entity_type: 'operator', related_entity_id: null, expires_at: null },
  { title: 'Certificado Mantención TLYF-23', category: 'documentos_vehiculos', tags: ['mantención'], related_entity_type: 'crane', related_entity_id: null, expires_at: null },
  { title: 'Certificado Vigencia GPS TLYF-23', category: 'documentos_vehiculos', tags: ['gps'], related_entity_type: 'crane', related_entity_id: null, expires_at: '2026-07-25' },
  { title: 'Certificado Frenos DSBZ-85', category: 'documentos_vehiculos', tags: ['certificado de frenos'], related_entity_type: 'crane', related_entity_id: null, expires_at: null },
  { title: 'Revisión Técnica DSBZ-85', category: 'documentos_vehiculos', tags: ['revisión técnica'], related_entity_type: 'crane', related_entity_id: null, expires_at: '2026-12-20' },
  { title: 'Conciliación Arrendadora', category: 'clientes', tags: ['conciliación'], related_entity_type: 'client', related_entity_id: null, expires_at: null },
  { title: 'Acta Recepción Caja Invierno TSSX-80', category: 'otros', tags: ['caja de invierno'], related_entity_type: 'service', related_entity_id: null, expires_at: null },
  { title: 'Acta Recepción Caja Invierno TSSX-54', category: 'otros', tags: ['caja de invierno'], related_entity_type: 'service', related_entity_id: null, expires_at: null },
  { title: 'Acta Entrega Caja Invierno  VWRR-22', category: 'otros', tags: [], related_entity_type: 'service', related_entity_id: null, expires_at: null },
  { title: 'Acta Entrega Caja Invierno VWRR-20', category: 'otros', tags: ['caja de invierno'], related_entity_type: 'service', related_entity_id: null, expires_at: null },
  { title: 'Formulario Acta Entrega Caja de Invierno', category: 'clientes', tags: ['plantilla'], related_entity_type: 'service', related_entity_id: null, expires_at: null },
];

const toDocument = (partial: (typeof REAL_DOCS)[number], index: number): BusinessDocument => ({
  id: `id-${index}`,
  description: null,
  file_name: `${index}.pdf`,
  file_path: `u/${index}.pdf`,
  file_type: 'application/pdf',
  file_size: 1024,
  document_date: '2026-06-01',
  is_confidential: false,
  uploaded_by: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  deleted_at: null,
  ...partial,
} as BusinessDocument);

const handlers = { onDownload: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), downloadingId: null };

describe('DocumentsFolderView', () => {
  it('muestra los 15 documentos reales completos, con "Sin relación" y el contador de vencidos del header', () => {
    const documents = REAL_DOCS.map(toDocument);
    render(<DocumentsFolderView documents={documents} isLoading={false} {...handlers} />);

    // Ningún documento se pierde por el agrupamiento (acordeones abiertos por defecto).
    // Un título real trae doble espacio: no colapsar espacios al comparar.
    const normalizer = getDefaultNormalizer({ collapseWhitespace: false });
    for (const document of documents) {
      expect(screen.getByText(document.title, { normalizer })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(15);

    // El sin entidad (Anexo) cae en "Sin relación".
    expect(screen.getByText('Sin relación')).toBeInTheDocument();

    // Secciones: contratos, documentos_vehiculos, proveedores, clientes, otros.
    const triggers = screen.getAllByRole('button', { expanded: true });
    expect(triggers).toHaveLength(5);

    // Contador de vencidos por sección == tarjeta VENCIDOS del header.
    const headerExpired = documents.filter((d) => getDocumentExpiryState(d.expires_at) === 'expired').length;
    const sectionExpiredBadges = screen.queryAllByText(/\d+ vencidos?$/);
    const sectionExpired = sectionExpiredBadges.reduce((sum, badge) => sum + Number(badge.textContent!.match(/^\d+/)![0]), 0);
    expect(sectionExpired).toBe(headerExpired);
  });

  it('en Importaciones crea un subgrupo por tag de proyecto', () => {
    const documents = [
      toDocument({ title: 'DIN Fontaine', category: 'importaciones', tags: ['fontaine-pxkz26', 'din'], related_entity_type: null, related_entity_id: null, expires_at: null }, 100),
      toDocument({ title: 'BL Fontaine', category: 'importaciones', tags: ['fontaine-pxkz26', 'bl'], related_entity_type: null, related_entity_id: null, expires_at: null }, 101),
      toDocument({ title: 'Cotización suelta', category: 'importaciones', tags: [], related_entity_type: null, related_entity_id: null, expires_at: null }, 102),
    ];
    render(<DocumentsFolderView documents={documents} isLoading={false} {...handlers} />);

    expect(screen.getByText('Importaciones')).toBeInTheDocument();
    const project = screen.getByText('fontaine-pxkz26', { selector: 'span' });
    expect(project).toBeInTheDocument();
    expect(within(project.parentElement!).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Sin proyecto')).toBeInTheDocument();
  });

  it('muestra el vacío cuando no hay documentos', () => {
    render(<DocumentsFolderView documents={[]} isLoading={false} {...handlers} />);
    expect(screen.getByText('No hay documentos para los filtros seleccionados.')).toBeInTheDocument();
  });
});
