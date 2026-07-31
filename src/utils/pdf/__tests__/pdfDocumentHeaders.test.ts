import { beforeEach, describe, expect, it, vi } from 'vitest';
import jsPDF from 'jspdf';
import { addPDFHeader, PDF_HEADER_BADGE_COLORS } from '../pdfHeader';

vi.mock('../companyDataFetcher', () => ({
  fetchCompanyData: async () => company,
}));

vi.mock('@/services/inspectionEquipmentCatalog', () => ({
  fetchInspectionEquipmentCatalog: async () => [],
}));

const company = {
  businessName: 'Grúas 5 Norte',
  rut: '76.123.456-7',
  address: 'Copiapó',
  phone: '+56 9 0000 0000',
  email: 'contacto@gruas5norte.cl',
};

const { generateInspectionPDF } = await import('@/utils/inspectionPdfGenerator');

const renderHeader = async (document: Parameters<typeof addPDFHeader>[2]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  await addPDFHeader(doc, company, document);
  return (doc.output('blob') as Blob).text();
};

describe('addPDFHeader', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
  });

  // Cada documento declara su identidad. Antes el helper la deducía de los
  // flags de inspección y contaminaba a todo el que no fuera una inspección.
  it.each([
    ['REPORTE DE INSPECCIÓN PRE-SERVICIO', 'PRE-SERVICIO', PDF_HEADER_BADGE_COLORS.provisional],
    ['ACTA DE SERVICIO', 'SERVICIO COMPLETADO', PDF_HEADER_BADGE_COLORS.final],
    ['DETALLES DEL SERVICIO', 'DOCUMENTO FINAL', PDF_HEADER_BADGE_COLORS.final],
    ['COMPROBANTE DE PAGO', 'PAGO RECIBIDO', PDF_HEADER_BADGE_COLORS.success],
  ])('rotula %s con el sello %s', async (documentTitle, label, color) => {
    const text = await renderHeader({
      documentTitle,
      badge: { label, color },
      folio: 'SRV-1',
    });

    // El título lleva tilde en un caso: se compara la parte ASCII estable.
    expect(text).toContain(documentTitle.split('Ó')[0]);
    expect(text).toContain(label);
  });

  it('usa el rótulo de folio que le pasan', async () => {
    const text = await renderHeader({
      documentTitle: 'COMPROBANTE DE PAGO',
      badge: { label: 'PAGO RECIBIDO', color: PDF_HEADER_BADGE_COLORS.success },
      folio: 'COMP-974F29FC',
      folioLabel: 'N',
    });

    expect(text).toContain('COMP-974F29FC');
  });
});

describe('generateInspectionPDF', () => {
  const service = {
    id: 'srv-1',
    folio: 'SRV-9001',
    serviceType: { id: 'st-1', name: 'Traslado', requiresDetail: false },
    client: { name: 'Cliente', rut: '1-9' },
    vehicleBrand: 'Toyota',
    vehicleModel: 'Hilux',
    licensePlate: 'ABCD12',
    origin: 'Copiapó',
    destination: 'Caldera',
  } as unknown as Parameters<typeof generateInspectionPDF>[0]['service'];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
  });

  // El acta de inspección es quien SÍ debe llevar ese encabezado: el fix del
  // comprobante no puede habérselo quitado.
  it('conserva el encabezado de inspección pre-servicio', async () => {
    const blob = await generateInspectionPDF(
      {
        service,
        inspection: { equipment: [] } as never,
        regenerationFooter: 'Regeneración administrativa',
      },
      false,
    );

    const text = await blob.text();
    expect(text).toContain('REPORTE DE INSPECCI');
    expect(text).toContain('PRE-SERVICIO');
    expect(text).toContain('SRV-9001');
  });

  it('rotula el informe final como documento final', async () => {
    const blob = await generateInspectionPDF(
      {
        service,
        inspection: { equipment: [] } as never,
        regenerationFooter: 'Regeneración administrativa',
      },
      true,
    );

    const text = await blob.text();
    expect(text).toContain('INFORME FINAL DE SERVICIO');
    expect(text).toContain('DOCUMENTO FINAL');
    expect(text).not.toContain('COMPROBANTE DE PAGO');
  });
});
