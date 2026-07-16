import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createLogger } from '@/lib/logger';
import type { LowboyContainerRow, LowboyContainerStatus } from '@/types/lowboyContainers';
import {
  CONTAINER_CONDITION_LABEL,
  CONTAINER_SIZE_LABEL,
  CONTAINER_STATUS_LABEL,
  CONTAINER_TYPE_LABEL,
  containerAdditionalCost,
  containerMargin,
  containerTotalCost,
} from '@/types/lowboyContainers';
import { businessClock } from '@/utils/businessClock';
import { safeDateToDisplaySlashes } from '@/utils/timezoneUtils';
import { fetchCompanyProfile } from './companyProfileFetcher';

const logger = createLogger('LowboyContainersPdf');

const LOWBOY_RUT = '78.387.656-6';
const LOWBOY_GREEN: [number, number, number] = [108, 160, 60];
const DARK: [number, number, number] = [20, 20, 20];
const GRAY: [number, number, number] = [105, 105, 105];
const LIGHT_GREEN: [number, number, number] = [240, 246, 233];
const WHITE: [number, number, number] = [255, 255, 255];
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 12;

const formatCLP = (value: number): string =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.warn('No se pudo cargar el logo para el informe', error);
    return null;
  }
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => resolve({ width: 100, height: 80 });
    image.src = dataUrl;
  });

export type LowboyContainersPdfInput = {
  containers: LowboyContainerRow[];
  statusFilter: 'all' | LowboyContainerStatus;
  search: string;
};

export type LowboyContainersPdfSummary = {
  available: number;
  reserved: number;
  sold: number;
  totalCost: number;
  saleNet: number;
  margin: number;
};

export const summarizeLowboyContainers = (containers: LowboyContainerRow[]): LowboyContainersPdfSummary =>
  containers.reduce<LowboyContainersPdfSummary>((summary, container) => {
    if (container.status === 'disponible') summary.available += 1;
    if (container.status === 'reservado') summary.reserved += 1;
    if (container.status === 'vendido') summary.sold += 1;
    summary.totalCost += containerTotalCost(container);
    if (container.status === 'vendido') {
      summary.saleNet += Number(container.sale_net_price || 0);
      summary.margin += containerMargin(container);
    }
    return summary;
  }, { available: 0, reserved: 0, sold: 0, totalCost: 0, saleNet: 0, margin: 0 });

export const generateLowboyContainersPdf = async ({
  containers,
  statusFilter,
  search,
}: LowboyContainersPdfInput): Promise<Blob> => {
  try {
    const profile = await fetchCompanyProfile(LOWBOY_RUT);
    const companyName = profile?.name || 'LowBoy Chile SpA.';
    const companyRut = profile?.rut || LOWBOY_RUT;
    const summary = summarizeLowboyContainers(containers);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFillColor(...LOWBOY_GREEN);
    doc.rect(0, 0, PAGE_W, 25, 'F');

    let textX = MARGIN;
    if (profile?.logoUrl) {
      const logo = await loadImageAsDataUrl(profile.logoUrl);
      if (logo) {
        try {
          const dimensions = await getImageDimensions(logo);
          const logoH = 17;
          const logoW = (dimensions.width / dimensions.height) * logoH;
          doc.addImage(logo, 'PNG', MARGIN, 4, logoW, logoH);
          textX += logoW + 5;
        } catch (error) {
          logger.warn('No se pudo embeber el logo en el informe', error);
        }
      }
    }

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(companyName, textX, 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text([`RUT: ${companyRut}`, profile?.address, profile?.phone].filter(Boolean).join('  |  '), textX, 17.5);

    let y = 34;
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Informe de inventario de contenedores', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const filterLabel = statusFilter === 'all' ? 'Todos los estados' : CONTAINER_STATUS_LABEL[statusFilter];
    const searchLabel = search.trim() ? `  |  Búsqueda: ${search.trim()}` : '';
    doc.text(`Filtro: ${filterLabel}${searchLabel}  |  ${containers.length} unidad${containers.length === 1 ? '' : 'es'}`, MARGIN, y + 6);

    y += 13;
    const cards = [
      ['Disponibles', String(summary.available)],
      ['Reservados', String(summary.reserved)],
      ['Vendidos', String(summary.sold)],
      ['Costo total', formatCLP(summary.totalCost)],
      ['Venta neta', formatCLP(summary.saleNet)],
      ['Margen vendido', formatCLP(summary.margin)],
    ];
    const gap = 3;
    const cardW = (PAGE_W - MARGIN * 2 - gap * (cards.length - 1)) / cards.length;
    cards.forEach(([label, value], index) => {
      const x = MARGIN + index * (cardW + gap);
      doc.setFillColor(...LIGHT_GREEN);
      doc.setDrawColor(208, 224, 191);
      doc.roundedRect(x, y, cardW, 17, 1.5, 1.5, 'FD');
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(label, x + 3, y + 5);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(value.length > 14 ? 10 : 12);
      doc.text(value, x + 3, y + 13);
    });
    y += 23;

    autoTable(doc, {
      startY: y,
      head: [['Serie', 'Unidad', 'Condición', 'Ingreso', 'Proveedor', 'Adquisición', 'Adicionales', 'Costo total', 'Estado', 'Venta neta', 'Margen']],
      body: containers.map((container) => [
        container.serial_number || 'Sin serie',
        `${CONTAINER_SIZE_LABEL[container.size]} / ${CONTAINER_TYPE_LABEL[container.container_type]}`,
        CONTAINER_CONDITION_LABEL[container.condition],
        safeDateToDisplaySlashes(container.acquisition_date),
        container.supplier_name || '-',
        formatCLP(container.acquisition_net_cost),
        formatCLP(containerAdditionalCost(container)),
        formatCLP(containerTotalCost(container)),
        CONTAINER_STATUS_LABEL[container.status],
        container.status === 'vendido' ? formatCLP(Number(container.sale_net_price)) : '-',
        container.status === 'vendido' ? formatCLP(containerMargin(container)) : '-',
      ]),
      foot: [[
        'TOTAL', '', '', '', '', '', '', formatCLP(summary.totalCost), '', formatCLP(summary.saleNet), formatCLP(summary.margin),
      ]],
      showFoot: 'lastPage',
      theme: 'grid',
      headStyles: { fillColor: LOWBOY_GREEN, textColor: WHITE, fontStyle: 'bold', fontSize: 7, valign: 'middle' },
      footStyles: { fillColor: LIGHT_GREEN, textColor: DARK, fontStyle: 'bold', fontSize: 7, halign: 'right' },
      styles: { fontSize: 6.8, cellPadding: 1.8, textColor: DARK, valign: 'middle', overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 250, 245] },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 20 },
        3: { cellWidth: 18 },
        4: { cellWidth: 38 },
        5: { cellWidth: 25, halign: 'right' },
        6: { cellWidth: 24, halign: 'right' },
        7: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 18 },
        9: { cellWidth: 25, halign: 'right' },
        10: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: MARGIN, right: MARGIN, bottom: 14 },
      didParseCell: (data) => {
        if (data.section === 'foot' && data.column.index === 0) data.cell.styles.halign = 'left';
      },
    });

    const generatedAt = businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm');
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...LOWBOY_GREEN);
      doc.setLineWidth(0.35);
      doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Montos netos en pesos chilenos  |  Generado: ${generatedAt}`, MARGIN, PAGE_H - 5.5);
      doc.text(`Página ${page} de ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5.5, { align: 'right' });
    }

    return doc.output('blob');
  } catch (error) {
    logger.error('Error generando informe PDF de contenedores', error);
    throw new Error('No fue posible generar el informe PDF de contenedores.');
  }
};
