import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Cost } from '@/types/costs';
import { Settings } from '@/types/settings';
import { addCompanyHeader } from '@/utils/reports/reportUtils';
import { parseFromDatabase, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { getCreatorDisplayName } from '@/types/common';

const formatCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return format(parseFromDatabase(d), 'dd/MM/yyyy', { locale: es }); } catch { return '—'; }
};

// Violet brand color (hsl 262 83% 58% ≈ #8b5cf6)
const VIOLET: [number, number, number] = [139, 92, 246];
const MUTED: [number, number, number] = [100, 100, 100];

export interface GenerateCostDetailPdfArgs {
  cost: Cost;
  settings: Settings;
  logoUrl?: string | null;
}

export const generateCostDetailPDF = async ({ cost, settings, logoUrl }: GenerateCostDetailPdfArgs) => {
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
  doc.setTextColor(...VIOLET);
  doc.text(formatCLP(Number(cost.amount)), pageWidth - marginX, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 6;

  // Description subtitle
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...MUTED);
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

  const basicRows: [string, string][] = [
    ['Fecha', fmtDate(cost.date)],
    ['Fecha de Pago', paymentDate ? fmtDate(paymentDate) : 'Pendiente'],
    ['Estado de Pago', isPaid ? 'Pagado' : 'Pendiente'],
    ['Categoría', category],
    ['Monto', formatCLP(Number(cost.amount))],
    ['Centro de Costo', (cost as any).cost_centers?.name || '—'],
    ['Folio Servicio', cost.service_folio || '—'],
    ['Tipo Documento', (cost as any).document_type || '—'],
    ['N° Documento', (cost as any).document_number || '—'],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [['Información Básica', '']],
    body: basicRows,
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: 60 }, 1: { cellWidth: contentWidth - 50 } },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Asociaciones ──
  const assocRows: [string, string][] = [];
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
    if ((cost.services as any).vehicle_brand || (cost.services as any).vehicle_model)
      assocRows.push(['Vehículo', `${(cost.services as any).vehicle_brand || ''} ${(cost.services as any).vehicle_model || ''}`.trim()]);
    if ((cost.services as any).license_plate) assocRows.push(['Patente', (cost.services as any).license_plate]);
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
      headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: 60 }, 1: { cellWidth: contentWidth - 50 } },
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
      headStyles: { fillColor: VIOLET, textColor: 255, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 1.5 },
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
      headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
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
      headStyles: { fillColor: VIOLET, textColor: 255, fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Footer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.height;
    doc.setDrawColor(220);
    doc.line(marginX, ph - 16, pageWidth - marginX, ph - 16);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const created = `Creado: ${formatForDisplayWithTime(cost.created_at)}${cost.creator ? ` por ${getCreatorDisplayName(cost.creator)}` : ''}`;
    const updated = `Actualizado: ${formatForDisplayWithTime(cost.updated_at)}`;
    doc.text(created, marginX, ph - 11);
    doc.text(updated, marginX, ph - 7);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, ph - 7, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  const safeDesc = (cost.description || 'costo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const fileName = `costo-${safeDesc}-${cost.date}.pdf`;
  doc.save(fileName);
};