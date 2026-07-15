import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { businessClock } from '@/utils/businessClock';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { createLogger } from '@/lib/logger';
import { fetchCompanyProfile } from './companyProfileFetcher';
import type { LowboyIvaMonth } from '@/hooks/siircv/useLowboyIva';

const logger = createLogger('LowboyIvaPdf');

// Verde del logo de LowBoy (aprox., ajustado al ojo contra el PNG).
const LOWBOY_GREEN: [number, number, number] = [108, 160, 60];
const DARK: [number, number, number] = [20, 20, 20];
const GRAY: [number, number, number] = [110, 110, 110];
const LIGHT: [number, number, number] = [244, 248, 238];
const WHITE: [number, number, number] = [255, 255, 255];

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const FALLBACK_NAME = 'LowBoy Chile SpA.';
const DISCLAIMER =
  'Estimación según RCV importado; el F29 real puede diferir (PPM, retenciones, remanente reajustado por UTM).';

const formatCLP = (n: number): string =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

/** 'YYYY-MM' → 'Julio 2026' (fecha civil, sin corrimiento de zona horaria). */
const monthLabel = (ym: string): string => {
  const l = safeParseDateOnly(`${ym}-01`).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return l.charAt(0).toUpperCase() + l.slice(1);
};

/** Mes siguiente en 'YYYY-MM' por aritmética pura de string (sin Date). */
const nextMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
};

/** fetch → blob → dataURL. PNG con transparencia (jsPDF lo soporta). null si falla. */
const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    logger.warn('No se pudo cargar el logo para el PDF', e);
    return null;
  }
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 100, height: 80 });
    img.src = dataUrl;
  });

export interface LowboyIvaPdfInput {
  entityRut: string;
  months: LowboyIvaMonth[];
  latest: LowboyIvaMonth;
}

export const generateLowboyIvaPdf = async (input: LowboyIvaPdfInput): Promise<Blob> => {
  try {
    const { entityRut, months, latest } = input;
    const profile = await fetchCompanyProfile(entityRut);
    const name = profile?.name || FALLBACK_NAME;
    const rut = profile?.rut || entityRut;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // ── Banda superior ────────────────────────────────────────────────────────
    doc.setFillColor(...LOWBOY_GREEN);
    doc.rect(0, 0, PAGE_W, 28, 'F');

    let textX = MARGIN;
    if (profile?.logoUrl) {
      const logo = await loadImageAsDataUrl(profile.logoUrl);
      if (logo) {
        try {
          const { width: w, height: h } = await getImageDimensions(logo);
          const maxH = 20;
          const logoH = Math.min(maxH, h);
          const logoW = (w / h) * logoH;
          doc.addImage(logo, 'PNG', MARGIN, 4, logoW, logoH);
          textX = MARGIN + logoW + 6;
        } catch (e) {
          logger.warn('No se pudo embeber el logo en el PDF', e);
        }
      }
    }

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(name, textX, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const identityParts = [`RUT: ${rut}`, profile?.address, profile?.phone].filter(Boolean) as string[];
    doc.text(identityParts.join(' · '), textX, 19);

    // ── Título ────────────────────────────────────────────────────────────────
    let y = 38;
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Informe de IVA — Registro de Compras y Ventas', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const rangeLabel = months.length > 1
      ? `Períodos ${monthLabel(months[0].month)} — ${monthLabel(months[months.length - 1].month)}`
      : `Período ${monthLabel(latest.month)}`;
    doc.text(rangeLabel, MARGIN, y + 6);
    y += 16;

    // ── Bloque destacado del último mes ────────────────────────────────────────
    const debePagar = latest.ivaPagar > 0;
    const BOX_H = 30;
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...LOWBOY_GREEN);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, BOX_H, 2, 2, 'FD');

    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Período ${monthLabel(latest.month)}`, MARGIN + 5, y + 7);

    // Métricas a la izquierda
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    const metrics: [string, string][] = [
      ['IVA débito fiscal', formatCLP(latest.ivaDebito)],
      ['IVA crédito fiscal', formatCLP(latest.ivaCredito)],
      ['Remanente anterior', formatCLP(latest.remanenteAnterior)],
    ];
    metrics.forEach(([label, value], i) => {
      const my = y + 13 + i * 5;
      doc.setTextColor(...GRAY);
      doc.text(label, MARGIN + 5, my);
      doc.setTextColor(...DARK);
      doc.text(value, MARGIN + 55, my, { align: 'right' });
    });

    // Cifra protagonista a la derecha
    const rightX = PAGE_W - MARGIN - 5;
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      debePagar ? `IVA a pagar · F29 de ${monthLabel(nextMonth(latest.month))}` : `F29 de ${monthLabel(nextMonth(latest.month))}`,
      rightX, y + 11, { align: 'right' },
    );
    doc.setTextColor(...(debePagar ? [198, 96, 20] as [number, number, number] : LOWBOY_GREEN));
    doc.setFontSize(22);
    doc.text(debePagar ? formatCLP(latest.ivaPagar) : formatCLP(latest.remanenteSiguiente), rightX, y + 22, { align: 'right' });
    if (!debePagar) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...LOWBOY_GREEN);
      doc.text('Remanente a favor', rightX, y + 27, { align: 'right' });
    }
    y += BOX_H + 8;

    // ── Tabla mensual ───────────────────────────────────────────────────────────
    const monthsDesc = [...months].reverse();
    const totalDebito = months.reduce((s, m) => s + m.ivaDebito, 0);
    const totalCredito = months.reduce((s, m) => s + m.ivaCredito, 0);
    const totalPagar = months.reduce((s, m) => s + m.ivaPagar, 0);

    autoTable(doc, {
      startY: y,
      head: [['Mes', 'IVA débito', 'IVA crédito', 'Remanente ant.', 'IVA a pagar', 'Remanente sig.']],
      body: monthsDesc.map((m) => [
        monthLabel(m.month),
        formatCLP(m.ivaDebito),
        formatCLP(m.ivaCredito),
        formatCLP(m.remanenteAnterior),
        formatCLP(m.ivaPagar),
        formatCLP(m.remanenteSiguiente),
      ]),
      foot: [['TOTAL', formatCLP(totalDebito), formatCLP(totalCredito), '—', formatCLP(totalPagar), '—']],
      theme: 'grid',
      headStyles: { fillColor: LOWBOY_GREEN, textColor: WHITE, fontSize: 8.5, fontStyle: 'bold', halign: 'right' },
      footStyles: { fillColor: [232, 240, 222], textColor: DARK, fontStyle: 'bold', fontSize: 8.5, halign: 'right' },
      styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: DARK, halign: 'right' },
      columnStyles: {
        0: { halign: 'left', cellWidth: 34 },
        4: { fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [248, 250, 245] },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (hookData) => {
        if (hookData.section === 'head') return;
        if (hookData.column.index === 0 && hookData.section === 'foot') hookData.cell.styles.halign = 'left';
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // ── Pie: nota + fecha de generación ─────────────────────────────────────────
    doc.setDrawColor(...LOWBOY_GREEN);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    const noteLines = doc.splitTextToSize(DISCLAIMER, CONTENT_W);
    doc.text(noteLines, MARGIN, 289);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generado: ${businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm')}`,
      PAGE_W - MARGIN, 293.5, { align: 'right' },
    );

    return doc.output('blob');
  } catch (error) {
    logger.error('Error generando PDF de informe IVA', error);
    throw new Error('Error al generar el PDF del informe de IVA');
  }
};
