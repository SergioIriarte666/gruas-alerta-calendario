import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Cost } from '@/types/costs';
import { Settings } from '@/types/settings';
import {
  addCompanyHeader,
  addStandardReportFooter,
  REPORT_PDF_COLORS,
} from '@/utils/reports/reportUtils';
import { parseFromDatabase, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { formatVehicleInfo, shouldShowVehicleInfo } from '@/utils/statusHelpers';
import { getCreatorDisplayName } from '@/types/common';

const formatCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return format(parseFromDatabase(d), 'dd/MM/yyyy', { locale: es }); } catch { return '—'; }
};

export interface GenerateCostDetailPdfArgs {
  cost: Cost;
  settings: Settings;
  logoUrl?: string | null;
}

export const generateCostDetailPDF = async ({ cost, settings, logoUrl }: GenerateCostDetailPdfArgs): Promise<{ blob: Blob; fileName: string }> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  let y = await addCompanyHeader(doc, settings.company, 15, logoUrl);

  // Title
  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Detalle de Costo', marginX, y);

  // Amount badge right-aligned
  doc.setFontSize(14);
  doc.setTextColor(...REPORT_PDF_COLORS.primaryDark);
  doc.text(formatCLP(Number(cost.amount)), pageWidth - marginX, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Description subtitle
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...REPORT_PDF_COLORS.muted);
  const descLines = doc.splitTextToSize(cost.description || '', contentWidth);
  doc.text(descLines, marginX, y);
  y += descLines.length * 5 + 2;
  doc.setTextColor(0, 0, 0);

  // ── Información Básica ──
  const category = cost.cost_categories
    ? cost.subcategory
      ? `${cost.cost_categories.name} > ${cost.subcategory}`
      : cost.cost_categories.name
    : 'Sin categoría';

  const paymentDate = (cost as any).payment_date as string | null | undefined;
  const isPaid = !!paymentDate;

  const supplier = (cost as any).inventory_suppliers as {
    name?: string; rut?: string; address?: string; phone?: string; email?: string;
  } | null | undefined;

  // La etiqueta cambia según si el costo tiene servicio asociado o no
  const folioLabel = cost.service_id ? 'Folio Servicio' : 'N° Doc. Proveedor';

  const basicRows: [string, string][] = [
    ['Fecha', fmtDate(cost.date)],
    ['Fecha de Pago', paymentDate ? fmtDate(paymentDate) : 'Pendiente'],
    ['Estado de Pago', isPaid ? 'Pagado' : 'Pendiente'],
    ['Categoría', category],
    ['Monto', formatCLP(Number(cost.amount))],
    ['Centro de Costo', cost.cost_centers?.name || '—'],
    [folioLabel, cost.service_folio || '—'],
    ['Tipo Documento', cost.document_type || '—'],
    ['N° Documento', cost.document_number || '—'],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [['Información Básica', '']],
    body: basicRows,
    theme: 'grid',
    headStyles: { fillColor: REPORT_PDF_COLORS.primary, textColor: REPORT_PDF_COLORS.white, fontStyle: 'normal', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2, lineColor: REPORT_PDF_COLORS.line },
    alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: REPORT_PDF_COLORS.muted }, 1: { cellWidth: contentWidth - 50 } },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Asociaciones ──
  const assocRows: [string, string][] = [];

  // Datos del proveedor (desde inventory_suppliers via join)
  if (supplier?.name) {
    assocRows.push(['Proveedor', supplier.name]);
    if (supplier.rut) assocRows.push(['RUT Proveedor', supplier.rut]);
    if (supplier.address) assocRows.push(['Dirección', supplier.address]);
    if (supplier.phone) assocRows.push(['Teléfono', supplier.phone]);
    if (supplier.email) assocRows.push(['Email', supplier.email]);
  }

  if (cost.cranes) {
    assocRows.push(['Grúa', `${cost.cranes.brand || ''} ${cost.cranes.model || ''} (${cost.cranes.license_plate || ''})`.trim()]);
    if (cost.cranes.type) assocRows.push(['Tipo de Grúa', cost.cranes.type]);
  }
  if (cost.operators) {
    assocRows.push(['Operador', `${cost.operators.name} (${cost.operators.rut})`]);
    if ((cost.operators as any).license_number) assocRows.push(['N° Licencia', (cost.operators as any).license_number]);
  }
  if (cost.services) {
    assocRows.push(['Servicio (Folio)', cost.services.folio || '—']);
    if ((cost.services as any).clients?.name) assocRows.push(['Cliente', (cost.services as any).clients.name]);
    if ((cost.services as any).request_date) assocRows.push(['Fecha Solicitud', fmtDate((cost.services as any).request_date)]);
    if ((cost.services as any).service_date) assocRows.push(['Fecha Servicio', fmtDate((cost.services as any).service_date)]);
    assocRows.push(['Vehículo', formatVehicleInfo(cost.services as any)]);
    if (shouldShowVehicleInfo(cost.services as any) && (cost.services as any).license_plate) {
      assocRows.push(['Patente', (cost.services as any).license_plate]);
    }
    if ((cost.services as any).origin) assocRows.push(['Origen', (cost.services as any).origin]);
    if ((cost.services as any).destination) assocRows.push(['Destino', (cost.services as any).destination]);
    if ((cost.services as any).purchase_order) assocRows.push(['Orden de Compra', (cost.services as any).purchase_order]);
    if ((cost.services as any).status) assocRows.push(['Estado Servicio', (cost.services as any).status]);
  }

  if (assocRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Asociaciones', '']],
      body: assocRows,
      theme: 'grid',
      headStyles: { fillColor: REPORT_PDF_COLORS.primary, textColor: REPORT_PDF_COLORS.white, fontStyle: 'normal', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 2, lineColor: REPORT_PDF_COLORS.line },
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: REPORT_PDF_COLORS.muted }, 1: { cellWidth: contentWidth - 50 } },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Piezas y repuestos ──
  const parts = (cost as any).crane_parts as any[] | null;
  if (parts && parts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Pieza', 'Proveedor', 'Cant.', 'Unitario', 'Total', 'Km']],
      body: parts.map((p) => [
        p.part_name || '—',
        p.supplier || '—',
        String(p.quantity ?? '—'),
        formatCLP(Number(p.unit_price || 0)),
        formatCLP(Number(p.total_value || (p.quantity || 0) * (p.unit_price || 0))),
        p.kilometraje != null ? String(p.kilometraje) : '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: REPORT_PDF_COLORS.primary, textColor: REPORT_PDF_COLORS.white, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Desglose de Ítems (supplier_invoice_items) ──
  const invoiceItems = cost.supplier_invoices?.supplier_invoice_items;
  if (invoiceItems && invoiceItems.length > 0) {
    const itemRows = [...invoiceItems]
      .sort((a, b) => (a.line_number ?? 0) - (b.line_number ?? 0))
      .map(item => [
        item.product_name || item.description || '—',
        item.description && item.description !== item.product_name
          ? item.description
          : '—',
        item.quantity != null ? String(item.quantity) : '—',
        item.unit_price != null
          ? formatCLP(Number(item.unit_price))
          : '—',
        item.subtotal != null
          ? formatCLP(Number(item.subtotal))
          : '—',
        item.tax_amount != null
          ? formatCLP(Number(item.tax_amount))
          : '—',
        item.total_amount != null
          ? formatCLP(Number(item.total_amount))
          : '—',
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Detalle', 'Cant.', 'P. Unit.', 'Neto', 'IVA', 'Total']],
      body: itemRows,
      theme: 'grid',
      headStyles: {
        fillColor: REPORT_PDF_COLORS.primary,
        textColor: REPORT_PDF_COLORS.white,
        fontStyle: 'normal',
        fontSize: 9,
      },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: REPORT_PDF_COLORS.soft },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 36 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: marginX, right: marginX },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Notas ──
  if (cost.notes) {
    autoTable(doc, {
      startY: y,
      head: [['Notas']],
      body: [[cost.notes]],
      theme: 'grid',
      headStyles: { fillColor: REPORT_PDF_COLORS.primary, textColor: REPORT_PDF_COLORS.white, fontStyle: 'normal', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Observaciones del servicio ──
  if ((cost.services as any)?.observations) {
    autoTable(doc, {
      startY: y,
      head: [['Observaciones del Servicio']],
      body: [[(cost.services as any).observations]],
      theme: 'grid',
      headStyles: { fillColor: REPORT_PDF_COLORS.primary, textColor: REPORT_PDF_COLORS.white, fontStyle: 'normal', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const created = `Creado: ${formatForDisplayWithTime(cost.created_at)}${cost.creator ? ` por ${getCreatorDisplayName(cost.creator)}` : ''}`;
  const updated = `Actualizado: ${formatForDisplayWithTime(cost.updated_at)}`;
  addStandardReportFooter(doc, { leftLines: [created, updated] });

  const safeDesc = (cost.description || 'costo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const fileName = `costo-${safeDesc}-${cost.date}.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
};
